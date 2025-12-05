_**🌍 Disaster Relief Resource Management System (DRRMS)**_

DRRMS is a full-stack TypeScript application that helps coordinators triage rescue requests, track inventory across warehouses, and push proactive allocation suggestions during fast-moving disasters. The platform exposes two SPA portals:

- 🧑‍🚒 **Rescuer Portal** – Admin view with live feeds, dynamic priority queue, predictive recommendations, and allocation tooling.
- 🆘 **Survivor Portal** – Form-based workflow for reporting incidents or requesting aid (currently backed by an in-memory store).

The current codebase (Fusion starter) ships with:

- React 18 + React Router 6 + Vite + Tailwind on the client.
- Express + Vite-integrated server with Drizzle ORM over SQLite.
- Shared type definitions in `shared/` to keep API responses in sync.
- Background schedulers for demand snapshots, predictive allocation, and live feed ingestion (weather + government alerts).

## 🎯 Project Objectives

- Prioritize requests using transparent scoring (severity, time decay, proximity, hub capacity, supply pressure).
- Give operators readouts on demand vs inventory and predictive lead times.
- Track transactions, allocations, and warehouse stock across hubs.
- Provide a survivor-friendly interface for logging incidents even before responders reach the field.
- Incrementally add advanced capabilities (offline sync, richer GIS, blockchain auditable logs) as the roadmap progresses.

## ⚙️ Implemented Features

- 🔐 Auth & role gating (survivor, rescuer, admin) with pending-approval workflow.
- 📦 Warehouse + resource inventory management, transfers, and allocation history.
- 🆘 Rescue request intake with priority snapshots stored in `request_priority_snapshots`.
- 📊 **Dynamic prioritization engine** with the latest signal set: time decay, supply pressure, geographic proximity, nearest hub capacity ratio, and rationale logging.
- 🤖 **Predictive allocation loop** that reads demand feature snapshots, calculates travel ETA based on nearest hub, and returns confidence/impact metrics.
- 🌦️ Live weather + alert feeds using Open-Meteo/weather.gov plus manual refresh controls.
- 📈 Demand heatmap + latency trend visualizations.
- 💰 Transaction logging for reimbursements/expenses.

## 🚧 Roadmap & Future Work

These items are planned but not yet fully implemented in the codebase:

- Survivor portal still relies on a local Zustand store; needs wiring to `/api/rescue-requests` and `/api/disaster-reports`.
- Offline-first and blockchain auditing are conceptual only.
- GIS experience is limited to aggregated grids—no live map overlays yet.
- PostgreSQL/PostGIS migration is a future step; current storage is SQLite via Drizzle.
- Background job observability (dashboards/health checks) is pending.
- Parameterized bootstrap datasets now ship via `pnpm db:seed`; infra automation still needs polish.

See `FEATURE_ROADMAP.md` for the long-form backlog.

### 🌦️ Real-Time Feed Configuration

The live feed scheduler now connects to real external sources by default (Open-Meteo for weather + weather.gov alerts). Configure behaviour via environment variables:

| Variable | Description | Default |
| --- | --- | --- |
| `WEATHER_PROVIDER` | `openweather`, `openmeteo`, or `mock`. `openmeteo` uses the free Open-Meteo API. | `openmeteo` (unless `WEATHER_API_KEY` is set)
| `WEATHER_API_KEY` | Required when `WEATHER_PROVIDER=openweather` to call the OpenWeather API. | – |
| `WEATHER_API_URL` | Optional override for provider base URL. | Provider default |
| `GOV_ALERT_PROVIDER` | `weather-gov`, `feed`, or `mock`. `weather-gov` consumes the public NOAA feed. | `weather-gov`
| `GOV_ALERT_BASE_URL` | Custom weather.gov endpoint (e.g., CAP filters). | `https://api.weather.gov/alerts/active`
| `GOV_ALERT_REGION` | Optional U.S. state/area filter passed as the `area` query param. | all regions |
| `GOV_ALERT_LIMIT` | Number of alerts to ingest per refresh (1–50). | 10 |
| `GOV_ALERT_FEED_URL` | If set, overrides the provider and ingests from your custom CAP/RSS feed. | – |

> Tip: When you need an authenticated weather feed, supply `WEATHER_API_KEY` for OpenWeather and keep a reasonable retry count with `LIVE_FEED_MAX_RETRIES`.

### 📈 Demand Snapshot Aggregation

Predictive recommendations now lean on rolling `demand_feature_snapshots`. The server aggregates every few minutes so the model can observe recent pending volume, inventory, and weather overlays.

| Variable | Description | Default |
| --- | --- | --- |
| `DEMAND_SNAPSHOT_INTERVAL_MS` | How often to run the aggregation scheduler. | 15 minutes |
| `DEMAND_SNAPSHOT_BUCKET_MINUTES` | Width of each bucket stored in `demand_feature_snapshots`. | 30 minutes |
| `DISABLE_DEMAND_SNAPSHOT` | Set to `true` to skip the scheduler (e.g., CI). | `false` |

Snapshots are also generated during `pnpm db:seed` so fresh environments ship with baseline data.

## 🛠️ Tech Stack (Current)

| Layer | Technology |
| --- | --- |
| Frontend | React 18, React Router 6, TypeScript, TailwindCSS, Radix UI, Vite |
| State | TanStack Query for server data, Zustand for lightweight local state |
| Backend | Express (TypeScript) running alongside Vite dev server |
| ORM / DB | Drizzle ORM + SQLite (dev) – pluggable to PostgreSQL later |
| Schedulers | Node timers for demand snapshots, predictive allocation, live feeds |
| Tooling | pnpm, Vitest, ESLint, Prettier |

Planned upgrades (not yet implemented): PostgreSQL/PostGIS migration, containerized deployment, background job runner moves to a queue (BullMQ/Celery equivalent).

## 🚀 Getting Started

1. **Install dependencies**

	```bash
	pnpm install
	```

2. **Start dev servers (client + server on port 8080)**

	```bash
	pnpm dev
	```

3. **Type checking & tests**

	```bash
	pnpm typecheck
	pnpm test
	```

4. **Production build & serve**

	```bash
	pnpm build
	pnpm start
	```

	### 📦 Bootstrap Sample Data

	Spin up realistic warehouses, resources, rescue requests, and historical `demand_feature_snapshots` with the seed profiles:

	```bash
	# Default developer dataset
	pnpm db:seed

	# Heavier narrative for demos
	pnpm db:seed demo

	# Lean production bootstrap (also works with SEED_PROFILE=prod pnpm db:seed)
	pnpm db:seed prod
	```

	All profiles ensure the admin/rescuer accounts exist, hydrate the baseline warehouses/resources, insert curated rescue tickets, and backfill multiple demand snapshot buckets so dashboards never appear empty after deploy.

### Background Schedulers & Env Vars

| Variable | Purpose | Default |
| --- | --- | --- |
| `PREDICTIVE_REFRESH_INTERVAL_MS` | How often the predictive allocation cycle runs. | `5 * 60 * 1000` |
| `PREDICTIVE_DEMAND_LOOKBACK_MS` | Demand history window for predictions. | `6 * 60 * 60 * 1000` |
| `DEMAND_SNAPSHOT_INTERVAL_MS` | Aggregation cadence for `demand_feature_snapshots`. | `15 * 60 * 1000` |
| `DEMAND_SNAPSHOT_BUCKET_MINUTES` | Bucket width stored in the snapshot table. | `30` |
| `DISABLE_DEMAND_SNAPSHOT`, `DISABLE_PREDICTIVE_SCHEDULER` | Set to `true` to stop schedulers (useful in CI). | `false` |
| `WEATHER_PROVIDER`, `WEATHER_API_KEY` | Configure Open-Meteo vs OpenWeather ingestion. | `openmeteo` |
| `GOV_ALERT_PROVIDER`, `GOV_ALERT_FEED_URL` | Choose weather.gov alerts or a custom CAP feed. | `weather-gov` |

After changing prioritization weights or schema columns, trigger a snapshot backfill so history lines up with the new logic:

```bash
curl -X POST http://localhost:8080/api/priorities/recalculate
```

This is the same endpoint behind the “Recalculate” button on the Admin Portal.

## 📊 How Prioritization Works Today

Each rescuer-visible request receives a score composed of:

- Severity weight (High/Medium/Low) ⚠️
- People count weight 👥
- Time-decay weight ⏱️ (exponential decay ~12h half-life)
- Supply pressure (pending vs total stock) 📦
- Geographic proximity to the nearest warehouse 📍
- Hub capacity ratio (stock/capacity) 🏭

Snapshots persist these weights plus the nearest hub metadata so operators can audit why a request shows up at the top of the queue.

Predictive recommendations reuse the same signals, add travel-time estimates, and output lead-time/confidence plus a rationale string.

**🔒 Security & Ethics**
Data Encryption for sensitive info

Role-Based Access Control (RBAC)

Transparency Logs for resource allocation

Ethical Use Guidelines – Built to save lives, not for misuse

## 🤝 Contributing

1. Fork the repo and create a feature branch (`feature/new-module`).
2. Run `pnpm typecheck` and `pnpm test` before pushing.
3. Open a PR describing the feature and any scheduler/env changes.

Check `CODEBASE_DOCUMENTATION.md` plus `ARCHITECTURE.md` for deeper references.

**👥 Team**
Frontend Engg - Arrnav Pawar, Mahendra Patil
Backend Engg - Krishna Patil
Documentation Lead - Saumya Patil
Domain: Disaster Relief & Resource Management
Institute: Vishwakarma Institute of Technology (VIT Pune)

**📜 License**

This project is licensed under the MIT License – free to use, modify, and distribute with attribution.

**🌟 Acknowledgements**

Disaster management frameworks (NDMA, UN OCHA)

Open-source communities (Flask, React, PostgreSQL)

Inspiration from real-world challenges faced during COVID-19, floods, and earthquakes
