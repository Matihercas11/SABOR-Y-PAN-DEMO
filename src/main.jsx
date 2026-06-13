import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CheckCircle,
  ClipboardList,
  Clock,
  Eye,
  Home,
  LogOut,
  Plus,
  Printer,
  Save,
  Search,
  Send,
  Settings,
  Store,
} from "lucide-react";
import { supabase, supabaseConfigured } from "./supabase";
import "./styles.css";

const DEADLINE_HOUR = 20;
const ADMIN_PIN = "ADMIN2026";

const todayKey = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

function normalizeCode(value) {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-CR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isAfterDeadline() {
  return new Date().getHours() >= DEADLINE_HOUR;
}

function emptyQuantities(products) {
  return products.reduce((acc, product) => {
    acc[product.id] = 0;
    return acc;
  }, {});
}

function groupedProducts(products, query, filter, quantities) {
  const normalized = query.trim().toLowerCase();
  const filtered = products.filter((product) => {
    if (!product.active) return false;
    const matchesSearch = normalized
      ? `${product.category} ${product.name}`.toLowerCase().includes(normalized)
      : true;
    const qty = Number(quantities[product.id] || 0);
    const matchesFilter =
      filter === "completed" ? qty > 0 : filter === "pending" ? qty === 0 : true;
    return matchesSearch && matchesFilter;
  });

  return filtered.reduce((acc, product) => {
    if (!acc[product.category]) acc[product.category] = [];
    acc[product.category].push(product);
    return acc;
  }, {});
}

function computeTotals(products, branches, orders) {
  const rows = products
    .filter((product) => product.active)
    .map((product) => ({
      id: product.id,
      category: product.category,
      product: product.name,
      total: 0,
      byBranch: {},
    }));

  const rowIndex = Object.fromEntries(rows.map((row) => [String(row.id), row]));

  branches.forEach((branch) => {
    const order = orders[branch.name];
    rows.forEach((row) => {
      const qty = Number(order?.quantities?.[row.id] || 0);
      row.byBranch[branch.name] = qty;
      row.total += qty;
    });
  });

  return rows.map((row) => rowIndex[String(row.id)]);
}

async function loadCloudState() {
  if (!supabase) throw new Error("Supabase no está configurado.");

  const [branchesResult, productsResult, ordersResult] = await Promise.all([
    supabase
      .from("sucursales")
      .select("id,nombre,codigo,activa,orden")
      .eq("activa", true)
      .order("orden", { ascending: true }),
    supabase
      .from("productos")
      .select("id,categoria,nombre,activo,temporada,orden")
      .order("orden", { ascending: true }),
    supabase
      .from("pedidos")
      .select(
        "id,sucursal_id,fecha,estado,enviado_at,actualizado_at,sucursales(nombre),pedido_detalle(producto_id,cantidad)"
      )
      .eq("fecha", todayKey()),
  ]);

  if (branchesResult.error) throw branchesResult.error;
  if (productsResult.error) throw productsResult.error;
  if (ordersResult.error) throw ordersResult.error;

  const branches = (branchesResult.data || []).map((branch) => ({
    id: branch.id,
    name: branch.nombre,
    code: branch.codigo,
    order: branch.orden,
  }));

  const products = (productsResult.data || []).map((product) => ({
    id: product.id,
    category: product.categoria,
    name: product.nombre,
    active: product.activo,
    seasonal: product.temporada,
    order: product.orden,
  }));

  const orders = {};
  (ordersResult.data || []).forEach((order) => {
    const branchName = order.sucursales?.nombre;
    if (!branchName) return;
    const quantities = {};
    (order.pedido_detalle || []).forEach((detail) => {
      quantities[detail.producto_id] = Number(detail.cantidad || 0);
    });
    orders[branchName] = {
      id: order.id,
      branchId: order.sucursal_id,
      status: order.estado,
      sentAt: order.enviado_at,
      updatedAt: order.actualizado_at,
      quantities,
    };
  });

  return { branches, products, orders };
}

async function saveOrderToCloud({ branch, products, quantities, status }) {
  const now = new Date().toISOString();
  const payload = {
    sucursal_id: branch.id,
    fecha: todayKey(),
    estado: status,
    actualizado_at: now,
    enviado_at: status === "enviado" ? now : null,
  };

  const { data: order, error: orderError } = await supabase
    .from("pedidos")
    .upsert(payload, { onConflict: "sucursal_id,fecha" })
    .select("id")
    .single();

  if (orderError) throw orderError;

  const details = products.map((product) => ({
    pedido_id: order.id,
    producto_id: product.id,
    cantidad: Number(quantities[product.id] || 0),
    updated_at: now,
  }));

  const { error: detailError } = await supabase
    .from("pedido_detalle")
    .upsert(details, { onConflict: "pedido_id,producto_id" });

  if (detailError) throw detailError;
}

function App() {
  const [state, setState] = useState({ branches: [], products: [], orders: {} });
  const [screen, setScreen] = useState(() =>
    window.location.hash === "#produccion" ? "production-tv" : "home"
  );
  const [session, setSession] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [pin, setPin] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [cloudError, setCloudError] = useState("");

  async function refreshState({ silent = false } = {}) {
    if (!supabaseConfigured) {
      setCloudError(
        "Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Vercel."
      );
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    try {
      const next = await loadCloudState();
      setState(next);
      setCloudError("");
    } catch (error) {
      console.error(error);
      setCloudError(error.message || "No se pudo conectar con Supabase.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    refreshState();
  }, []);

  useEffect(() => {
    if (!supabaseConfigured || !supabase) return undefined;

    const interval = setInterval(() => refreshState({ silent: true }), 10000);
    const channel = supabase
      .channel("sabor-y-pan-cambios")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () =>
        refreshState({ silent: true })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedido_detalle" },
        () => refreshState({ silent: true })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "productos" }, () =>
        refreshState({ silent: true })
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }

  function logout() {
    setSession(null);
    setSelectedBranch(null);
    setPin("");
    setScreen("home");
  }

  function handleLogin(type) {
    const clean = normalizeCode(pin);

    if (type === "branch") {
      if (!selectedBranch || clean !== normalizeCode(selectedBranch.code)) {
        showToast("Contraseña incorrecta para esta sucursal.");
        return;
      }
      setSession({ type: "branch", branch: selectedBranch });
      setPin("");
      setScreen("branch-order");
      return;
    }

    if (type === "admin") {
      if (clean !== ADMIN_PIN) {
        showToast("Código de administrador incorrecto.");
        return;
      }
      setSession({ type: "admin" });
      setPin("");
      setScreen("admin");
    }
  }

  if (loading) {
    return <div className="fullPageMessage">Conectando con la nube…</div>;
  }

  if (cloudError) {
    return (
      <div className="fullPageMessage errorMessage">
        <h2>No se pudo conectar con la nube</h2>
        <p>{cloudError}</p>
        <button className="primaryBtn" onClick={() => refreshState()}>
          Volver a intentar
        </button>
      </div>
    );
  }

  return (
    <div className={screen === "production-tv" ? "tvMode" : ""}>
      {toast && <div className="toast">{toast}</div>}

      {screen !== "production-tv" && (
        <header className="topbar">
          <div className="brand" onClick={() => setScreen("home")}>
            <div className="brandIcon">
              <Store size={22} />
            </div>
            <div>
              <h1>Sabor y Pan</h1>
              <p>Pedidos internos de producción</p>
            </div>
          </div>
          {session && (
            <button className="ghostBtn" onClick={logout}>
              <LogOut size={18} /> Salir
            </button>
          )}
        </header>
      )}

      <main className={screen === "production-tv" ? "tvContainer" : "container"}>
        {screen === "home" && (
          <HomeScreen
            branches={state.branches}
            setScreen={setScreen}
            setSelectedBranch={setSelectedBranch}
          />
        )}

        {screen === "branch-login" && (
          <LoginScreen
            title={`Sucursal: ${selectedBranch?.name || ""}`}
            subtitle="Digite la contraseña corta de esta sucursal."
            icon={<ClipboardList size={34} />}
            pin={pin}
            setPin={setPin}
            onLogin={() => handleLogin("branch")}
            onBack={() => {
              setSelectedBranch(null);
              setScreen("home");
            }}
          />
        )}

        {screen === "admin-login" && (
          <LoginScreen
            title="Ingreso administrador"
            subtitle="Panel para revisar pedidos, productos e impresión."
            icon={<Settings size={34} />}
            pin={pin}
            setPin={setPin}
            onLogin={() => handleLogin("admin")}
            onBack={() => setScreen("home")}
          />
        )}

        {screen === "branch-order" && session?.type === "branch" && (
          <BranchOrder
            branch={session.branch}
            state={state}
            refreshState={refreshState}
            showToast={showToast}
            onExit={logout}
          />
        )}

        {screen === "production-tv" && <ProductionTV state={state} />}

        {screen === "admin" && session?.type === "admin" && (
          <AdminView
            state={state}
            refreshState={refreshState}
            showToast={showToast}
          />
        )}
      </main>
    </div>
  );
}

function HomeScreen({ branches, setScreen, setSelectedBranch }) {
  function openBranch(branch) {
    setSelectedBranch(branch);
    setScreen("branch-login");
  }

  return (
    <section className="hero">
      <div className="heroText compactHero">
        <span className="pill">Pedidos diarios</span>
        <h2>Seleccione la sucursal</h2>
        <p>Toque la sucursal correcta para comenzar el pedido.</p>
      </div>

      <div className="branchGrid">
        {branches.map((branch) => (
          <button className="branchCard" key={branch.id} onClick={() => openBranch(branch)}>
            <Store size={34} />
            <h3>{branch.name}</h3>
          </button>
        ))}
      </div>

      <div className="adminAccess">
        <button className="homeCard adminCard" onClick={() => setScreen("admin-login")}>
          <Settings size={36} />
          <div>
            <h3>Administrador</h3>
            <p>Revisar pedidos, modificar productos e imprimir.</p>
          </div>
        </button>
      </div>
    </section>
  );
}

function LoginScreen({ title, subtitle, icon, pin, setPin, onLogin, onBack }) {
  return (
    <section className="loginCard">
      <div className="loginIcon">{icon}</div>
      <h2>{title}</h2>
      <p>{subtitle}</p>
      <input
        className="pinInput"
        type="text"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck="false"
        placeholder="Escriba la contraseña"
        value={pin}
        onChange={(event) => setPin(event.target.value.toUpperCase())}
        onKeyDown={(event) => event.key === "Enter" && onLogin()}
        autoFocus
      />
      <button className="primaryBtn wide" onClick={onLogin}>
        Entrar
      </button>
      <button className="ghostBtn wide" onClick={onBack}>
        <Home size={18} /> Volver al inicio
      </button>
    </section>
  );
}

function BranchOrder({ branch, state, refreshState, showToast, onExit }) {
  const existing = state.orders[branch.name];
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [quantities, setQuantities] = useState(() => ({
    ...emptyQuantities(state.products),
    ...(existing?.quantities || {}),
  }));
  const [review, setReview] = useState(false);
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setQuantities({
      ...emptyQuantities(state.products),
      ...(state.orders[branch.name]?.quantities || {}),
    });
  }, [state.products, state.orders, branch.name]);

  const groups = useMemo(
    () => groupedProducts(state.products, query, filter, quantities),
    [state.products, query, filter, quantities]
  );

  function changeQty(productId, value) {
    const clean = Math.max(0, Number(value || 0));
    setQuantities((previous) => ({ ...previous, [productId]: clean }));
  }

  async function save(status) {
    setSaving(true);
    try {
      await saveOrderToCloud({
        branch,
        products: state.products,
        quantities,
        status,
      });
      await refreshState({ silent: true });
      if (status === "enviado") {
        setReview(false);
        setSent(true);
      } else {
        showToast("Borrador guardado en la nube.");
      }
    } catch (error) {
      console.error(error);
      showToast(`No se pudo guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  const completedCount = state.products.filter(
    (product) => product.active && Number(quantities[product.id] || 0) > 0
  ).length;
  const activeCount = state.products.filter((product) => product.active).length;
  const pendingCount = activeCount - completedCount;
  const totalItems = Object.values(quantities).reduce(
    (total, value) => total + Number(value || 0),
    0
  );
  const selectedProducts = state.products
    .filter((product) => Number(quantities[product.id] || 0) > 0)
    .map((product) => ({ ...product, qty: Number(quantities[product.id]) }));

  if (sent) {
    return (
      <section className="sentScreen">
        <CheckCircle size={82} />
        <h2>Pedido enviado correctamente</h2>
        <p>El pedido de <strong>{branch.name}</strong> ya quedó guardado en la nube.</p>
        <div className="whatsappNotice">
          Ahora notifique por WhatsApp que el pedido ya fue enviado.
        </div>
        <button className="primaryBtn wide sentButton" onClick={onExit}>
          Volver al inicio
        </button>
      </section>
    );
  }

  if (review) {
    return (
      <section>
        <PageHeader
          title="Revise antes de enviar"
          subtitle={`${branch.name} · ${new Date().toLocaleDateString("es-CR")}`}
        />
        <div className="summaryBox">
          <h3>Total del pedido: {totalItems} unidades</h3>
          <p>Revise bien las cantidades antes de confirmar.</p>
        </div>
        <div className="tableCard">
          <table>
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Producto</th>
                <th className="right">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {selectedProducts.length === 0 ? (
                <tr>
                  <td colSpan="3">No hay productos con cantidad.</td>
                </tr>
              ) : (
                selectedProducts.map((product) => (
                  <tr key={product.id}>
                    <td>{product.category}</td>
                    <td>{product.name}</td>
                    <td className="right strong">{product.qty}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="actionRow">
          <button className="ghostBtn" onClick={() => setReview(false)} disabled={saving}>
            Volver a editar
          </button>
          <button
            className="primaryBtn"
            onClick={() => save("enviado")}
            disabled={saving || selectedProducts.length === 0}
          >
            <Send size={18} /> {saving ? "Enviando…" : "Confirmar y enviar"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        title={`Pedido diario: ${branch.name}`}
        subtitle={`Fecha: ${new Date().toLocaleDateString("es-CR")} · Hora límite: 8:00 p. m.`}
      />

      {isAfterDeadline() && (
        <div className="warningBox">
          <Clock size={20} /> Ya pasó la hora límite de las 8:00 p. m.
        </div>
      )}

      {existing?.status === "enviado" && (
        <div className="successBox">
          <CheckCircle size={20} /> Esta sucursal ya envió hoy a las {formatTime(existing.sentAt)}.
        </div>
      )}

      <div className="progressFilters">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
          Todos ({activeCount})
        </button>
        <button
          className={filter === "pending" ? "active" : ""}
          onClick={() => setFilter("pending")}
        >
          Falta ({pendingCount})
        </button>
        <button
          className={filter === "completed" ? "active" : ""}
          onClick={() => setFilter("completed")}
        >
          Completados ({completedCount})
        </button>
      </div>

      <div className="toolbar">
        <div className="searchBox">
          <Search size={18} />
          <input
            placeholder="Buscar producto…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="totalBadge">Total: {totalItems}</div>
      </div>

      {Object.entries(groups).map(([category, products]) => (
        <div className="categoryCard" key={category}>
          <h3>{category}</h3>
          <div className="productGrid">
            {products.map((product) => {
              const completed = Number(quantities[product.id] || 0) > 0;
              return (
                <div className={`productItem ${completed ? "productCompleted" : ""}`} key={product.id}>
                  <label>
                    {product.name}
                    {completed && <span className="completedMark">Completado</span>}
                  </label>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={quantities[product.id] || ""}
                    onChange={(event) => changeQty(product.id, event.target.value)}
                    placeholder="0"
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="stickyActions">
        <button className="secondaryBtn" onClick={() => save("borrador")} disabled={saving}>
          <Save size={18} /> {saving ? "Guardando…" : "Guardar"}
        </button>
        <button className="primaryBtn" onClick={() => setReview(true)} disabled={saving}>
          <Eye size={18} /> Revisar y enviar
        </button>
      </div>
    </section>
  );
}

function ProductionTV({ state }) {
  const totals = computeTotals(state.products, state.branches, state.orders).filter(
    (row) => row.total > 0
  );
  const grandTotal = totals.reduce((total, row) => total + row.total, 0);
  const sentCount = state.branches.filter(
    (branch) => state.orders[branch.name]?.status === "enviado"
  ).length;

  return (
    <section className="tvBoard">
      <div className="tvHeader compactTvHeader">
        <div>
          <h1>Producción diaria</h1>
          <p>{new Date().toLocaleDateString("es-CR")} · Actualización automática</p>
        </div>
        <div className="tvStats">
          <div>
            <small>Total</small>
            <b>{grandTotal}</b>
          </div>
          <div>
            <small>Sucursales</small>
            <b>{sentCount}/{state.branches.length}</b>
          </div>
        </div>
      </div>

      {totals.length === 0 ? (
        <div className="tvEmpty">Aún no hay pedidos enviados para hoy.</div>
      ) : (
        <div className="tvProductGridCompact">
          {totals.map((row) => (
            <div className="tvProductCompact" key={row.id}>
              <div>
                <small>{row.category}</small>
                <span>{row.product}</span>
              </div>
              <b>{row.total}</b>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ProductionView({ state }) {
  const [showOnlyWithQty, setShowOnlyWithQty] = useState(true);
  const totals = computeTotals(state.products, state.branches, state.orders).filter(
    (row) => !showOnlyWithQty || row.total > 0
  );
  const grandTotal = totals.reduce((total, row) => total + row.total, 0);
  const sentCount = state.branches.filter(
    (branch) => state.orders[branch.name]?.status === "enviado"
  ).length;

  return (
    <section className="productionScreen">
      <PageHeader
        title="Pedido total de producción"
        subtitle={`Fecha: ${new Date().toLocaleDateString("es-CR")}`}
      />
      <div className="kpiGrid">
        <div className="kpi"><span>Total a producir</span><b>{grandTotal}</b></div>
        <div className="kpi"><span>Sucursales enviadas</span><b>{sentCount}/{state.branches.length}</b></div>
        <div className="kpi"><span>Hora límite</span><b>8:00 p. m.</b></div>
      </div>
      <div className="actionRow noPrint">
        <label className="checkLine">
          <input
            type="checkbox"
            checked={showOnlyWithQty}
            onChange={(event) => setShowOnlyWithQty(event.target.checked)}
          />
          Mostrar solo productos con cantidad
        </label>
        <button className="secondaryBtn" onClick={() => window.print()}>
          <Printer size={18} /> Imprimir
        </button>
      </div>
      <div className="tableCard productionTable">
        <table>
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Producto</th>
              {state.branches.map((branch) => (
                <th className="right" key={branch.id}>{branch.name}</th>
              ))}
              <th className="right totalCol">Total</th>
            </tr>
          </thead>
          <tbody>
            {totals.length === 0 ? (
              <tr><td colSpan={state.branches.length + 3}>Aún no hay cantidades registradas.</td></tr>
            ) : (
              totals.map((row) => (
                <tr key={row.id}>
                  <td>{row.category}</td>
                  <td className="strong">{row.product}</td>
                  {state.branches.map((branch) => (
                    <td className="right" key={branch.id}>{row.byBranch[branch.name]}</td>
                  ))}
                  <td className="right totalCell">{row.total}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AdminView({ state, refreshState, showToast }) {
  const [tab, setTab] = useState("status");
  const [newProduct, setNewProduct] = useState({
    category: "Temporada",
    name: "",
    seasonal: true,
  });
  const [working, setWorking] = useState(false);

  const statuses = state.branches.map((branch) => {
    const order = state.orders[branch.name];
    return {
      branch: branch.name,
      status:
        order?.status === "enviado"
          ? "Enviado"
          : order?.status === "borrador"
            ? "Borrador"
            : "Pendiente",
      sentAt: order?.sentAt,
      updatedAt: order?.updatedAt,
    };
  });

  async function addProduct() {
    const name = newProduct.name.trim();
    const category = newProduct.category.trim();
    if (!name) {
      showToast("Digite el nombre del producto.");
      return;
    }

    setWorking(true);
    const nextOrder = Math.max(0, ...state.products.map((product) => product.order || 0)) + 1;
    const { error } = await supabase.from("productos").insert({
      categoria: category || "Sin categoría",
      nombre: name,
      activo: true,
      temporada: Boolean(newProduct.seasonal),
      orden: nextOrder,
    });
    setWorking(false);

    if (error) {
      showToast(`No se pudo agregar: ${error.message}`);
      return;
    }

    setNewProduct({ category: "Temporada", name: "", seasonal: true });
    await refreshState({ silent: true });
    showToast("Producto agregado en la nube.");
  }

  async function toggleProduct(product) {
    setWorking(true);
    const { error } = await supabase
      .from("productos")
      .update({ activo: !product.active })
      .eq("id", product.id);
    setWorking(false);

    if (error) {
      showToast(`No se pudo modificar: ${error.message}`);
      return;
    }
    await refreshState({ silent: true });
  }

  async function resetTodayOrders() {
    const confirmed = window.confirm(
      "¿Seguro que desea borrar únicamente los pedidos de hoy? Los productos no se borrarán."
    );
    if (!confirmed) return;

    setWorking(true);
    const { error } = await supabase.from("pedidos").delete().eq("fecha", todayKey());
    setWorking(false);

    if (error) {
      showToast(`No se pudieron borrar: ${error.message}`);
      return;
    }
    await refreshState({ silent: true });
    showToast("Pedidos de hoy reiniciados.");
  }

  return (
    <section>
      <PageHeader title="Panel administrador" subtitle="Información guardada en Supabase." />
      <div className="tabs">
        <button className={tab === "status" ? "active" : ""} onClick={() => setTab("status")}>Estado de pedidos</button>
        <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>Productos</button>
        <button className={tab === "production" ? "active" : ""} onClick={() => setTab("production")}>Consolidado</button>
      </div>

      {tab === "status" && (
        <>
          <div className="tableCard">
            <table>
              <thead>
                <tr><th>Sucursal</th><th>Estado</th><th>Hora de envío</th><th>Última actualización</th></tr>
              </thead>
              <tbody>
                {statuses.map((status) => (
                  <tr key={status.branch}>
                    <td className="strong">{status.branch}</td>
                    <td><span className={`status ${status.status.toLowerCase()}`}>{status.status}</span></td>
                    <td>{formatTime(status.sentAt)}</td>
                    <td>{formatTime(status.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="dangerBtn" disabled={working} onClick={resetTodayOrders}>
            Reiniciar pedidos de hoy
          </button>
        </>
      )}

      {tab === "products" && (
        <>
          <div className="formCard">
            <h3>Agregar producto nuevo o de temporada</h3>
            <div className="formGrid">
              <input
                placeholder="Categoría"
                value={newProduct.category}
                onChange={(event) => setNewProduct({ ...newProduct, category: event.target.value })}
              />
              <input
                placeholder="Nombre del producto"
                value={newProduct.name}
                onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })}
              />
              <label className="checkLine">
                <input
                  type="checkbox"
                  checked={newProduct.seasonal}
                  onChange={(event) => setNewProduct({ ...newProduct, seasonal: event.target.checked })}
                />
                Producto de temporada
              </label>
              <button className="primaryBtn" disabled={working} onClick={addProduct}>
                <Plus size={18} /> Agregar
              </button>
            </div>
          </div>
          <div className="tableCard">
            <table>
              <thead>
                <tr><th>Categoría</th><th>Producto</th><th>Tipo</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {state.products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.category}</td>
                    <td className="strong">{product.name}</td>
                    <td>{product.seasonal ? "Temporada" : "Regular"}</td>
                    <td>{product.active ? "Activo" : "Inactivo"}</td>
                    <td className="right">
                      <button className="smallBtn" disabled={working} onClick={() => toggleProduct(product)}>
                        {product.active ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "production" && <ProductionView state={state} />}
    </section>
  );
}

function PageHeader({ title, subtitle }) {
  return (
    <div className="pageHeader">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
