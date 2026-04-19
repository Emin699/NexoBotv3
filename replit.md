# NexoShop — Telegram Digital Shop Bot

## Project Overview

NexoShop is a Telegram-bot-based digital marketplace for selling digital goods (streaming subscriptions, IPTV, etc.) with a React-based status dashboard.

## Architecture

**Monorepo** managed with `pnpm` workspaces.

### Applications (`artifacts/`)
- **`api-server`** — Express.js backend (port 8080) running the Telegram bot (polling mode in dev, webhook in prod), REST API, and payment webhooks
- **`status`** — React + Vite frontend (port 5000) status dashboard for monitoring service availability
- **`mockup-sandbox`** — Vite dev server for UI component prototyping

### Libraries (`lib/`)
- **`db`** — Drizzle ORM schema + PostgreSQL connection (uses `DATABASE_URL` in dev, `NEON_DATABASE_URL` in prod)
- **`api-spec`** — OpenAPI spec definitions
- **`api-zod`** — Generated Zod schemas from the API spec
- **`api-client-react`** — Generated TanStack Query hooks for the frontend

## Tech Stack

| Layer | Technology |
|---|---|
| Package Manager | pnpm (workspace monorepo) |
| Language | TypeScript (strict) |
| Backend | Express.js v5, node-telegram-bot-api |
| Frontend | React 19, Vite 7, Tailwind CSS v4, Shadcn UI |
| Database | PostgreSQL via Drizzle ORM (Replit local in dev, Neon in prod) |
| Logging | Pino + pino-pretty |

## Development Workflows

- **"Start application"** — Status frontend on port 5000 (`PORT=5000 pnpm --filter @workspace/status run dev`)
- **"API Server"** — Backend + Telegram bot on port 8080 (`PORT=8080 pnpm --filter @workspace/api-server run start`)

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (runtime-managed by Replit in dev) |
| `NEON_DATABASE_URL` | Neon PostgreSQL URL for production |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from BotFather |
| `ADMIN_TELEGRAM_ID` | Telegram user ID of the admin |
| `PORT` | Port number (5000 for status frontend, 8080 for api-server) |

## Database

Schema is managed with Drizzle ORM. Tables: `users`, `transactions`, `referrals`, `reviews`, `deezer_links`, `iptv_stock`, `paypal_payments`, `sumup_checkouts`, `wheel_spins`, `jackpot_tickets`.

- `wheel_spins` — tracks daily spin cooldown and total spin count per user
- `jackpot_tickets` — one ticket per purchase, used for weekly admin jackpot draws

Run schema push: `pnpm --filter @workspace/db run push-force`

## Mini-Games (implemented)

### Roue du Destin (daily wheel spin)
- Accessible via Menu Informations → 🎡 Roue du Destin
- One spin per day per user; animated reveal message
- Prizes: Dommage (70% real / 50% shown), -5% coupon (20%/40%), -10€ coupon (5%/20%), 50 pts (3%/30%), Deezer link (2%/10%)
- Prize probs configured in `artifacts/api-server/src/bot/minigames.ts` → `WHEEL_PRIZES`

### Jackpot Lottery
- 1 ticket earned per purchase (any product)
- Admin draws winner via `/tirage` command or Admin → Mini-Jeux panel
- Winning user notified automatically; ticket marked as drawn

### Purchase Milestones
- Tracked via `purchaseCount` on `users` table
- Milestones: 1→20pts, 5→-5% coupon, 10→100pts, 15→-10% coupon, 20→200pts, 30→-15€ coupon, 50→Deezer link
- Reward sent automatically after purchase via `onPurchaseComplete()`

### Deezer Bulk Lots
- Replaces single Deezer purchase button with lot menu
- Lots: 1 link=2€, 10=5€, 50=15€, 200=20€
- Configured in `DEEZER_LOTS` array in `minigames.ts`

### `onPurchaseComplete()` hooked into all purchase flows:
- Deezer single, Deezer generator, Deezer lots
- Netflix/PS/Spotify subscriptions, new-style subscriptions
- IPTV, tech/méthodes, Basic-Fit/FitnessParK, cart checkout

## Deployment

- **Target**: VM (always-running, required for Telegram polling)
- **Build**: Builds api-server (esbuild) and status (Vite)
- **Run**: Both status frontend (port 5000) and api-server (port 8080) run concurrently
