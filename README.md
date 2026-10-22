# CoinTrack

A personal finance application with transaction search, budgets, accounts, goals, recurring entries, CSV import/export and payment-method suggestions. Uses React, TypeScript and a Node backend with optional MongoDB Atlas persistence.

## Run locally

```sh
npm ci
npm run build
npm start
```

Open http://localhost:4317. Without a configured database the app provides an explicitly labelled synthetic demo. Demo names, balances, merchants and masked card suffixes are invented examples. New authenticated workspaces start empty.

For persistence, copy the variable names from `.env.example` into a private environment file outside the repository. Supply your own MongoDB credentials and set `DOTENV_CONFIG_PATH` to that file before starting. Never place database credentials in frontend variables or commit them. `APP_ORIGIN` must match the browser origin exactly; keep the listener on loopback when using HTTPS forwarding.

```sh
npm run check
npm test
```

Deployment examples are in `deploy/`; adapt paths and service configuration to your host. See [product scope](docs/PRODUCT.md). This source distribution contains no personal ledger or database export.
