import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ClipboardList,
  Factory,
  Settings,
  Store,
  CheckCircle,
  Clock,
  Plus,
  Printer,
  LogOut,
  Eye,
  Home,
  Save,
  Send,
  Search
} from "lucide-react";
import "./styles.css";

const DEADLINE_HOUR = 20;

const BRANCH_CODES = {
  LG2026: "La Guácima",
  GA2026: "Guácima Abajo",
  CI2026: "Ciruelas",
  CO2026: "El Coyol",
  TU2026: "Turrúcares",
};

const ADMIN_PIN = "ADMIN2026";
const PRODUCTION_PIN = "PAN2026";

const INITIAL_PRODUCTS = [
  ["Hojaldre", "Cachos grandes"],
  ["Hojaldre", "Cachos pequeños"],
  ["Hojaldre", "Costillas"],
  ["Hojaldre", "Tosteles"],
  ["Hojaldre", "Enchilada papa grande"],
  ["Hojaldre", "Estrudel de dulce y pastel"],
  ["Hojaldre", "Pqt empanadas dulce leche"],
  ["Hojaldre", "Pañuelos"],
  ["Hojaldre", "Prusianos"],
  ["Hojaldre", "Rollo carne"],
  ["Hojaldre", "Orejas"],
  ["Hojaldre", "Torta chilena"],
  ["Hojaldre", "Galletas varias empacada"],

  ["Pastelería", "Quesadillas"],
  ["Pastelería", "Pupusas"],
  ["Pastelería", "Nido"],
  ["Pastelería", "Bizcocho grande"],
  ["Pastelería", "Bandeja rollos"],
  ["Pastelería", "Pqt borrachos"],
  ["Pastelería", "Pizza para slice"],
  ["Pastelería", "Trenza crema pastelera"],
  ["Pastelería", "Cocadas grandes"],
  ["Pastelería", "Dona grande"],
  ["Pastelería", "Dona pequeña"],
  ["Pastelería", "Manita dulce"],
  ["Pastelería", "Quesadillas rojas"],
  ["Pastelería", "Alfajor peruano"],

  ["Pasta danesa", "Coronas"],
  ["Pasta danesa", "Trenza canela manzana"],
  ["Pasta danesa", "Rollos canel grandes"],
  ["Pasta danesa", "Rollos canel pequeños"],
  ["Pasta danesa", "Rollos jamón y queso"],
  ["Pasta danesa", "Rollos pollo"],
  ["Pasta danesa", "Rollos queso cebolla"],
  ["Pasta danesa", "Cangrejo jamón queso"],
  ["Pasta danesa", "Chilaquilas"],
  ["Pasta danesa", "Pizzitas"],

  ["Panes dulces", "Pan casero (bonetes)"],
  ["Panes dulces", "P relleno dulce leche"],
  ["Panes dulces", "P dulce sin relleno"],
  ["Panes dulces", "P queso crem"],
  ["Panes dulces", "Trenza dulce lec y marac"],
  ["Panes dulces", "Puriscaleño guayaba"],

  ["Trenzas", "T especies"],
  ["Trenzas", "Puriscaleño"],
  ["Trenzas", "Coco piña dulce"],
  ["Trenzas", "T amor"],
  ["Trenzas", "T saladas"],
  ["Trenzas", "Queso jamón"],
  ["Trenzas", "Manita natillera"],
  ["Trenzas", "Natillero"],
  ["Trenzas", "Aliñado"],

  ["Pan dulce casero", "Pqt pan dulce casero"],
  ["Pan dulce casero", "Paquetes de gatos"],
  ["Pan dulce casero", "Palito de queso"],
  ["Pan dulce casero", "Queque chocolate por unidad"],

  ["Queques", "Queque seco pequeño"],
  ["Queques", "Queque seco mediano"],
  ["Queques", "Queque seco grande"],
  ["Queques", "Queques decorados"],
  ["Queques", "Queques húmedos"],
  ["Queques", "Cajita tres leches"],
  ["Queques", "Tres leches grande"],

  ["Otros", "Pan molido"],
  ["Otros", "Galletas trebol"],
  ["Otros", "Baguette"],
  ["Otros", "Manitas de baguette"],
  ["Otros", "Pan tostado paquete"],
  ["Otros", "Media luna"],
  ["Otros", "Suspiros paquete"],
  ["Otros", "Churros"],

  ["Burbujas", "Alfajor azúcar"],
  ["Burbujas", "Alfajor chocolate"],
  ["Burbujas", "Bizcocho jalea"],
  ["Burbujas", "Bizcocho corriente"],
  ["Burbujas", "Cocadas"],
  ["Burbujas", "Empanadas piña"],
  ["Burbujas", "Guayabitas"],
  ["Burbujas", "Palitos queso"],
  ["Burbujas", "Mangueadas"],
  ["Burbujas", "Galleta chips"],

  ["Tamales", "Asado"],
  ["Tamales", "Budín"],
  ["Tamales", "Maizena"],
  ["Tamales", "Torta arroz"],
  ["Tamales", "Casero"],
  ["Tamales", "Tortuga"],
  ["Tamales", "Tapitas"],
];

const todayKey = () => new Date().toISOString().slice(0, 10);

function makeInitialProducts() {
  return INITIAL_PRODUCTS.map((item, index) => ({
    id: `p-${index + 1}`,
    category: item[0],
    name: item[1],
    active: true,
    seasonal: false,
  }));
}

function loadState() {
  const saved = localStorage.getItem("sabor_y_pan_state");
  if (saved) return JSON.parse(saved);
  return {
    products: makeInitialProducts(),
    orders: {},
  };
}

function saveState(state) {
  localStorage.setItem("sabor_y_pan_state", JSON.stringify(state));
}

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-CR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isAfterDeadline() {
  const now = new Date();
  return now.getHours() >= DEADLINE_HOUR;
}

function groupedProducts(products, query = "") {
  const normalized = query.trim().toLowerCase();
  const active = products.filter((p) => p.active);
  const filtered = normalized
    ? active.filter((p) =>
        `${p.category} ${p.name}`.toLowerCase().includes(normalized)
      )
    : active;

  return filtered.reduce((acc, product) => {
    if (!acc[product.category]) acc[product.category] = [];
    acc[product.category].push(product);
    return acc;
  }, {});
}

function getOrderKey(branchName, dateValue = todayKey()) {
  return `${dateValue}__${branchName}`;
}

function emptyQuantities(products) {
  return products.reduce((acc, p) => {
    acc[p.id] = 0;
    return acc;
  }, {});
}

function computeTotals(products, orders, dateValue = todayKey()) {
  const totals = products
    .filter((p) => p.active)
    .map((p) => ({
      id: p.id,
      category: p.category,
      product: p.name,
      total: 0,
      byBranch: {},
    }));

  const index = Object.fromEntries(totals.map((t) => [t.id, t]));

  Object.values(BRANCH_CODES).forEach((branch) => {
    const order = orders[getOrderKey(branch, dateValue)];
    totals.forEach((t) => {
      const qty = Number(order?.quantities?.[t.id] || 0);
      t.byBranch[branch] = qty;
      t.total += qty;
    });
  });

  return totals;
}

function App() {
  const [state, setState] = useState(loadState);
  const [screen, setScreen] = useState("home");
  const [session, setSession] = useState(null);
  const [pin, setPin] = useState("");
  const [toast, setToast] = useState("");

  function updateState(next) {
    setState(next);
    saveState(next);
  }

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(""), 2500);
  }

  function logout() {
    setSession(null);
    setPin("");
    setScreen("home");
  }

  function handleLogin(type) {
    const clean = pin.trim().toUpperCase();

    if (type === "branch") {
      const branchName = BRANCH_CODES[clean];
      if (!branchName) {
        showToast("Código incorrecto. Revise e intente de nuevo.");
        return;
      }
      setSession({ type: "branch", branchName });
      setPin("");
      setScreen("branch-order");
      return;
    }

    if (type === "production") {
      if (clean !== PRODUCTION_PIN) {
        showToast("Código de producción incorrecto.");
        return;
      }
      setSession({ type: "production" });
      setPin("");
      setScreen("production");
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
      return;
    }
  }

  return (
    <div>
      {toast && <div className="toast">{toast}</div>}

      <header className="topbar">
        <div className="brand" onClick={() => setScreen("home")}>
          <div className="brandIcon"><Store size={22} /></div>
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

      <main className="container">
        {screen === "home" && (
          <HomeScreen setScreen={setScreen} />
        )}

        {screen === "branch-login" && (
          <LoginScreen
            title="Ingreso de sucursal"
            subtitle="Digite el código de la sucursal para realizar el pedido diario."
            icon={<ClipboardList size={34} />}
            pin={pin}
            setPin={setPin}
            onLogin={() => handleLogin("branch")}
            onBack={() => setScreen("home")}
          />
        )}

        {screen === "production-login" && (
          <LoginScreen
            title="Ingreso de producción"
            subtitle="Vista sencilla para panaderos. Muestra el pedido total del día."
            icon={<Factory size={34} />}
            pin={pin}
            setPin={setPin}
            onLogin={() => handleLogin("production")}
            onBack={() => setScreen("home")}
          />
        )}

        {screen === "admin-login" && (
          <LoginScreen
            title="Ingreso administrador"
            subtitle="Panel para revisar pedidos, productos y sucursales."
            icon={<Settings size={34} />}
            pin={pin}
            setPin={setPin}
            onLogin={() => handleLogin("admin")}
            onBack={() => setScreen("home")}
          />
        )}

        {screen === "branch-order" && session?.type === "branch" && (
          <BranchOrder
            branchName={session.branchName}
            state={state}
            updateState={updateState}
            showToast={showToast}
          />
        )}

        {screen === "production" && session?.type === "production" && (
          <ProductionView state={state} />
        )}

        {screen === "admin" && session?.type === "admin" && (
          <AdminView
            state={state}
            updateState={updateState}
            showToast={showToast}
          />
        )}
      </main>
    </div>
  );
}

function HomeScreen({ setScreen }) {
  return (
    <section className="hero">
      <div className="heroText">
        <span className="pill">Demo navegable</span>
        <h2>Sistema digital de pedidos internos</h2>
        <p>
          Cada sucursal registra su pedido antes de las 8:00 p. m. y producción ve automáticamente el total a elaborar.
        </p>
      </div>

      <div className="homeGrid">
        <button className="homeCard" onClick={() => setScreen("branch-login")}>
          <ClipboardList size={36} />
          <h3>Ingresar como sucursal</h3>
          <p>Para registrar el pedido diario de pan.</p>
        </button>

        <button className="homeCard" onClick={() => setScreen("production-login")}>
          <Factory size={36} />
          <h3>Ver producción</h3>
          <p>Pantalla limpia para panaderos o televisor.</p>
        </button>

        <button className="homeCard" onClick={() => setScreen("admin-login")}>
          <Settings size={36} />
          <h3>Administrador</h3>
          <p>Revisar estados, productos e historial.</p>
        </button>
      </div>

      <div className="demoCodes">
        <h3>Códigos demo</h3>
        <p><b>La Guácima:</b> LG2026 · <b>Guácima Abajo:</b> GA2026 · <b>Ciruelas:</b> CI2026 · <b>El Coyol:</b> CO2026 · <b>Turrúcares:</b> TU2026</p>
        <p><b>Producción:</b> PAN2026 · <b>Admin:</b> ADMIN2026</p>
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
        type="password"
        placeholder="Digite el código"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onLogin()}
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

function BranchOrder({ branchName, state, updateState, showToast }) {
  const orderKey = getOrderKey(branchName);
  const existing = state.orders[orderKey];
  const [query, setQuery] = useState("");
  const [quantities, setQuantities] = useState(
    existing?.quantities || emptyQuantities(state.products)
  );
  const [review, setReview] = useState(false);

  const afterDeadline = isAfterDeadline();
  const groups = useMemo(
    () => groupedProducts(state.products, query),
    [state.products, query]
  );

  function changeQty(productId, value) {
    const clean = Math.max(0, Number(value || 0));
    setQuantities((prev) => ({ ...prev, [productId]: clean }));
  }

  function saveDraft() {
    const next = {
      ...state,
      orders: {
        ...state.orders,
        [orderKey]: {
          branchName,
          date: todayKey(),
          status: existing?.status === "sent" ? "sent" : "draft",
          quantities,
          updatedAt: new Date().toISOString(),
          sentAt: existing?.sentAt || null,
        },
      },
    };
    updateState(next);
    showToast("Pedido guardado correctamente.");
  }

  function sendOrder() {
    const next = {
      ...state,
      orders: {
        ...state.orders,
        [orderKey]: {
          branchName,
          date: todayKey(),
          status: "sent",
          quantities,
          updatedAt: new Date().toISOString(),
          sentAt: new Date().toISOString(),
        },
      },
    };
    updateState(next);
    setReview(false);
    showToast("Pedido enviado a producción.");
  }

  const totalItems = Object.values(quantities).reduce((a, b) => a + Number(b || 0), 0);
  const selectedProducts = state.products
    .filter((p) => Number(quantities[p.id] || 0) > 0)
    .map((p) => ({ ...p, qty: Number(quantities[p.id]) }));

  if (review) {
    return (
      <section>
        <PageHeader
          title="Revise antes de enviar"
          subtitle={`${branchName} · ${new Date().toLocaleDateString("es-CR")}`}
        />

        <div className="summaryBox">
          <h3>Total del pedido: {totalItems} unidades</h3>
          <p>Revise bien las cantidades. Al confirmar, producción verá el pedido.</p>
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
                <tr><td colSpan="3">No hay productos con cantidad.</td></tr>
              ) : selectedProducts.map((p) => (
                <tr key={p.id}>
                  <td>{p.category}</td>
                  <td>{p.name}</td>
                  <td className="right strong">{p.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="actionRow">
          <button className="ghostBtn" onClick={() => setReview(false)}>Volver a editar</button>
          <button className="primaryBtn" onClick={sendOrder}>
            <Send size={18} /> Confirmar y enviar
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        title={`Pedido diario: ${branchName}`}
        subtitle={`Fecha: ${new Date().toLocaleDateString("es-CR")} · Hora límite: 8:00 p. m.`}
      />

      {afterDeadline && (
        <div className="warningBox">
          <Clock size={20} />
          Ya pasó la hora límite de las 8:00 p. m. Esta demo todavía permite guardar, pero en la versión real se puede bloquear.
        </div>
      )}

      {existing?.status === "sent" && (
        <div className="successBox">
          <CheckCircle size={20} />
          Esta sucursal ya envió el pedido hoy a las {formatTime(existing.sentAt)}.
        </div>
      )}

      <div className="toolbar">
        <div className="searchBox">
          <Search size={18} />
          <input
            placeholder="Buscar producto..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="totalBadge">Total: {totalItems}</div>
      </div>

      {Object.entries(groups).map(([category, products]) => (
        <div className="categoryCard" key={category}>
          <h3>{category}</h3>
          <div className="productGrid">
            {products.map((p) => (
              <div className="productItem" key={p.id}>
                <label>{p.name}</label>
                <input
                  type="number"
                  min="0"
                  value={quantities[p.id] || ""}
                  onChange={(e) => changeQty(p.id, e.target.value)}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="stickyActions">
        <button className="secondaryBtn" onClick={saveDraft}>
          <Save size={18} /> Guardar
        </button>
        <button className="primaryBtn" onClick={() => setReview(true)}>
          <Eye size={18} /> Revisar y enviar
        </button>
      </div>
    </section>
  );
}

function ProductionView({ state }) {
  const [showOnlyWithQty, setShowOnlyWithQty] = useState(true);
  const totals = computeTotals(state.products, state.orders).filter(
    (row) => !showOnlyWithQty || row.total > 0
  );

  const grandTotal = totals.reduce((a, b) => a + b.total, 0);
  const sentCount = Object.values(BRANCH_CODES).filter(
    (branch) => state.orders[getOrderKey(branch)]?.status === "sent"
  ).length;

  return (
    <section className="productionScreen">
      <PageHeader
        title="Pedido total de producción"
        subtitle={`Fecha: ${new Date().toLocaleDateString("es-CR")} · Última actualización: ${new Date().toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })}`}
      />

      <div className="kpiGrid">
        <div className="kpi"><span>Total a producir</span><b>{grandTotal}</b></div>
        <div className="kpi"><span>Sucursales enviadas</span><b>{sentCount}/5</b></div>
        <div className="kpi"><span>Hora límite</span><b>8:00 p. m.</b></div>
      </div>

      <div className="actionRow noPrint">
        <label className="checkLine">
          <input
            type="checkbox"
            checked={showOnlyWithQty}
            onChange={(e) => setShowOnlyWithQty(e.target.checked)}
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
              <th className="right">La Guácima</th>
              <th className="right">Guácima Abajo</th>
              <th className="right">Ciruelas</th>
              <th className="right">El Coyol</th>
              <th className="right">Turrúcares</th>
              <th className="right totalCol">Total</th>
            </tr>
          </thead>
          <tbody>
            {totals.length === 0 ? (
              <tr><td colSpan="8">Aún no hay cantidades registradas.</td></tr>
            ) : totals.map((row) => (
              <tr key={row.id}>
                <td>{row.category}</td>
                <td className="strong">{row.product}</td>
                {Object.values(BRANCH_CODES).map((branch) => (
                  <td className="right" key={branch}>{row.byBranch[branch]}</td>
                ))}
                <td className="right totalCell">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AdminView({ state, updateState, showToast }) {
  const [tab, setTab] = useState("status");
  const [newProduct, setNewProduct] = useState({
    category: "Temporada",
    name: "",
    seasonal: true,
  });

  const statuses = Object.values(BRANCH_CODES).map((branch) => {
    const order = state.orders[getOrderKey(branch)];
    return {
      branch,
      status: order?.status === "sent" ? "Enviado" : order?.status === "draft" ? "Borrador" : "Pendiente",
      sentAt: order?.sentAt,
      updatedAt: order?.updatedAt,
    };
  });

  function addProduct() {
    const name = newProduct.name.trim();
    if (!name) {
      showToast("Digite el nombre del producto.");
      return;
    }

    const product = {
      id: `p-${Date.now()}`,
      category: newProduct.category.trim() || "Sin categoría",
      name,
      active: true,
      seasonal: Boolean(newProduct.seasonal),
    };

    updateState({ ...state, products: [...state.products, product] });
    setNewProduct({ category: "Temporada", name: "", seasonal: true });
    showToast("Producto agregado correctamente.");
  }

  function toggleProduct(productId) {
    const products = state.products.map((p) =>
      p.id === productId ? { ...p, active: !p.active } : p
    );
    updateState({ ...state, products });
  }

  function resetDemo() {
    const ok = window.confirm("¿Seguro que desea reiniciar todos los datos demo?");
    if (!ok) return;
    const next = { products: makeInitialProducts(), orders: {} };
    updateState(next);
    showToast("Demo reiniciada.");
  }

  return (
    <section>
      <PageHeader
        title="Panel administrador"
        subtitle="Control básico de pedidos, productos y estado diario."
      />

      <div className="tabs">
        <button className={tab === "status" ? "active" : ""} onClick={() => setTab("status")}>Estado de pedidos</button>
        <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>Productos</button>
        <button className={tab === "production" ? "active" : ""} onClick={() => setTab("production")}>Consolidado</button>
      </div>

      {tab === "status" && (
        <div className="tableCard">
          <table>
            <thead>
              <tr>
                <th>Sucursal</th>
                <th>Estado</th>
                <th>Hora de envío</th>
                <th>Última actualización</th>
              </tr>
            </thead>
            <tbody>
              {statuses.map((s) => (
                <tr key={s.branch}>
                  <td className="strong">{s.branch}</td>
                  <td><span className={`status ${s.status.toLowerCase()}`}>{s.status}</span></td>
                  <td>{formatTime(s.sentAt)}</td>
                  <td>{formatTime(s.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "products" && (
        <>
          <div className="formCard">
            <h3>Agregar producto nuevo o de temporada</h3>
            <div className="formGrid">
              <input
                placeholder="Categoría"
                value={newProduct.category}
                onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
              />
              <input
                placeholder="Nombre del producto"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              />
              <label className="checkLine">
                <input
                  type="checkbox"
                  checked={newProduct.seasonal}
                  onChange={(e) => setNewProduct({ ...newProduct, seasonal: e.target.checked })}
                />
                Producto de temporada
              </label>
              <button className="primaryBtn" onClick={addProduct}><Plus size={18} /> Agregar</button>
            </div>
          </div>

          <div className="tableCard">
            <table>
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {state.products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.category}</td>
                    <td className="strong">{p.name}</td>
                    <td>{p.seasonal ? "Temporada" : "Regular"}</td>
                    <td>{p.active ? "Activo" : "Inactivo"}</td>
                    <td className="right">
                      <button className="smallBtn" onClick={() => toggleProduct(p.id)}>
                        {p.active ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="dangerBtn" onClick={resetDemo}>Reiniciar demo</button>
        </>
      )}

      {tab === "production" && (
        <ProductionView state={state} />
      )}
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
