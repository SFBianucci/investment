# Portfolio Tracker — Node.js + Express

API REST para tracking de inversiones con análisis cuantitativo en tiempo real.

## Stack

- **Runtime**: Node.js 18+
- **Framework**: Express 4
- **Datos**: Yahoo Finance public endpoints (fetch nativo)
- **FX**: dolarapi.com (dólar oficial, blue, MEP, CCL)

## Instalación rápida

```bash
# 1. Instalar dependencias
npm install

# 2. Modo desarrollo (hot reload)
npm run dev

# 3. Producción
npm start
```

El servidor corre en `http://localhost:3000`

En producción (Vercel):

- Frontend en `/`
- API en `/api/*` (ej: `/api/fx`, `/api/portfolio/summary`)

---

## Estructura del proyecto

```
portfolio-tracker/
├── src/
│   ├── server.js      ← Entry point, rutas Express
│   ├── portfolio.js   ← Config del portfolio + valorización
│   ├── yahoo.js       ← Wrapper Yahoo Finance (fetch)
│   ├── indicators.js  ← RSI, MACD, Bollinger, Scoring
│   ├── sp500.js       ← S&P 500 lista + quotes en batch
│   ├── fx.js          ← Cotizaciones dólar ARG
│   ├── analysis.js    ← Re-export de analyzeTicker
│   └── cache.js       ← Cache en memoria con TTL 5min
├── frontend/
│   └── index.html     ← Dashboard (abrí directo en el browser)
├── package.json
├── .gitignore
└── README.md
```

---

## Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/` | Health check + lista de endpoints |
| GET | `/fx` | Dólar oficial, blue, MEP, CCL |
| GET | `/portfolio/summary` | Portfolio completo con precios actuales |
| GET | `/portfolio/signals` | Señales compra/venta ordenadas por score |
| GET | `/analyze/:ticker` | Análisis completo de cualquier ticker |
| GET | `/sp500` | Lista S&P 500 con precio y var. diaria |
| GET | `/sp500/sectors` | S&P 500 agrupado por sector |
| GET | `/sp500/top?n=20&order=gainers` | Top gainers o losers |
| GET | `/sp500/analyze/:ticker` | Análisis completo de ticker S&P 500 |
| GET | `/cache/clear` | Limpia el caché (fuerza datos frescos) |

---

## Configurar tu portfolio

Editá el objeto `PORTFOLIO` en `src/portfolio.js`:

```js
export const PORTFOLIO = {
  cedears: [
    { ticker: 'AAPL', sector: 'Tecnología', qty: 28, avgPriceARS: 18410 },
    // ...
  ],
  accionesARG: [
    // Siempre usar sufijo .BA para acciones argentinas
    { ticker: 'GGAL.BA', display: 'GGAL', name: 'Grupo Financiero Galicia', sector: 'Finanzas', qty: 70, avgPriceARS: 6060 },
    // ...
  ],
  // ...
}
```

---

## Algoritmo de scoring (0–100)

| Dimensión | Peso | Indicadores |
|-----------|------|-------------|
| Técnico | 50% | RSI (20pt) + MACD histogram (15pt) + Bollinger %B (15pt) |
| Fundamental | 35% | P/E ratio (15pt) + Revenue Growth YoY (10pt) + Profit Margin (10pt) |
| Momentum | 15% | Golden Cross vs Death Cross SMA50/200 (15pt) |

| Score | Señal |
|-------|-------|
| 78–100 | Compra fuerte |
| 60–77 | Comprar |
| 42–59 | Mantener |
| 28–41 | Reducir |
| 0–27 | Vender |

---

## Notas

- **Cache**: 5 min en memoria. Limpiá con `GET /cache/clear`.
- **Acciones ARG**: yfinance usa sufijo `.BA` (ej: `GGAL.BA`).
- **CEDEARs en ARS**: precio USD × tipo CCL desde dolarapi.com.
- **S&P 500 completo**: primera carga ~15–30 seg (batch de 100 tickers).
- **Bonos ARG**: precios son los que cargaste. Para tiempo real necesitás API de Rava/IOL.
- Node.js 18+ requerido (usa `fetch` nativo).

---

## Deploy en Vercel + Git

Este repo ya está preparado para Vercel con `vercel.json` y `api/index.js`.

### 1. Subir a GitHub

```bash
git init
git add .
git commit -m "chore: preparar proyecto para Vercel"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

### 2. Deploy en Vercel

1. Importá el repo desde Vercel (New Project).
2. Framework preset: `Other` (o detectado automático).
3. Build command: vacío.
4. Output directory: vacío.
5. Deploy.

### 3. Variables de entorno (opcional)

Actualmente no hay variables obligatorias para correr. Si agregás APIs privadas en el futuro, cargalas en Vercel en `Project Settings > Environment Variables`.
