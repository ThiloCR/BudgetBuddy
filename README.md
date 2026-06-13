# BudgetBuddy

A personal finance tracker that makes it easy to keep track of your money. BudgetBuddy is a fast, fully client‑side budgeting app — accounts, envelope‑style budgets, transactions, and spending insights, all running in your browser with no server and no sign‑up.

**🔗 Live demo:** https://thilocr.github.io/BudgetBuddy/ &nbsp;·&nbsp; **Demo data:** load a sample dataset from **Settings → Data** to explore the app instantly.

> ⚠️ This is a personal portfolio project. All data is stored locally in your browser (`localStorage`) and never leaves your device.

---

## Features

- **Accounts** — track chequing, savings, cash, credit, TFSA, RRSP, investment, and mortgage accounts, with a running net‑worth total.
- **Envelope budgeting** — organize spending into categories and groups, set monthly limits, and allocate available money to each category.
- **Transactions** — record income, expenses, and transfers; split a single transaction across multiple categories; bulk‑edit and bulk‑delete.
- **Dashboard** — accounts summary, an interactive donut of spending‑by‑category (hover to inspect, top‑10 + "Other" grouping), and a spending‑trend chart.
- **Themes** — light and dark modes with a toggle (follows your OS preference by default), plus switchable accent colors.
- **Import / export** — back up and restore your data as CSV (or a ZIP bundle).
- **Demo data** — load a realistic sample dataset from **Settings → Data** to explore the app instantly.
- **Responsive** — works on desktop and mobile, with a dedicated bottom navigation on small screens.

## Tech stack

BudgetBuddy is intentionally dependency‑light — no framework, no build step. Just open `index.html`.

- **Vanilla JavaScript** (ES classes), HTML, and CSS
- A small **service layer** that keeps app logic separated from the DOM:
  - [`services/DataStore.js`](services/DataStore.js) — all CRUD operations and `localStorage` persistence
  - [`services/MoneyService.js`](services/MoneyService.js) — money math (avoiding floating‑point errors)
  - [`services/UIStateManager.js`](services/UIStateManager.js) — view/UI state
  - [`services/DemoData.js`](services/DemoData.js) — generates the sample dataset
- **Plus Jakarta Sans** + **Space Grotesk** (via Google Fonts) for typography; a CSS custom‑property design system for theming; hand‑rolled `<canvas>` charts (no chart library)

## Running locally

No install or build is required. Either:

```bash
# Option 1 — just open the file
open index.html        # macOS
start index.html       # Windows

# Option 2 — serve it (recommended; some browsers restrict file:// features)
python -m http.server 8000
# then visit http://localhost:8000
```

## Project structure

```
BudgetBuddy/
├── index.html              # App shell + all views/modals
├── app.js                  # Application logic & rendering
├── styles.css              # Styles
├── services/               # Framework-free service layer
│   ├── DataStore.js
│   ├── MoneyService.js
│   ├── UIStateManager.js
│   └── DemoData.js
├── favicon.svg             # Logo mark (the in-app logo is inline SVG)
└── BBbrandguidelines.md    # Brand & design guidelines
```

## License

[MIT](LICENSE) © Thilo Reinartz
