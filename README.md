# Sabor y Pan | Demo de Pedidos Internos

App demo navegable hecha en React + Vite.

## Objetivo

Digitalizar el pedido interno diario de las sucursales de Sabor y Pan para que cada sucursal registre su pedido antes de las 8:00 p. m. y producción pueda ver automáticamente el consolidado total.

## Sucursales incluidas

- La Guácima
- Guácima Abajo
- Ciruelas
- El Coyol
- Turrúcares

## Códigos de acceso demo

### Sucursales

- La Guácima: `LG2026`
- Guácima Abajo: `GA2026`
- Ciruelas: `CI2026`
- El Coyol: `CO2026`
- Turrúcares: `TU2026`

### Producción

- Código: `PAN2026`

### Administrador

- Código: `ADMIN2026`

## Cómo correr localmente

```bash
npm install
npm run dev
```

Luego abrir la URL que muestra la terminal.

## Cómo subir a Railway o Vercel

1. Crear un repositorio en GitHub.
2. Subir todos estos archivos.
3. Conectar el repositorio en Railway o Vercel.
4. Configurar el comando de build:
   ```bash
   npm run build
   ```
5. Configurar el comando de ejecución:
   ```bash
   npm run preview
   ```

## Nota importante

Esta es una demo frontend. Guarda datos en `localStorage` del navegador. Sirve para enseñar el flujo al jefe y validar la idea.

Para una versión real operativa se recomienda agregar backend y base de datos:
- React
- Node.js / Express
- PostgreSQL
- Railway o Supabase
