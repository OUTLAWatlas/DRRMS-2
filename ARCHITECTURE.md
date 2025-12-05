# DRRMS Architecture Guide

## System Architecture Overview

This document provides a detailed technical architecture of the DRRMS (Disaster Relief Resource Management System).

---

## 1. Application Architecture

### High-Level System Design

```
┌───────────────────────────────────────────────────────────────────┐
│                         DRRMS Platform                            │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐                              ┌─────────────┐   │
│  │   Browser   │                              │   Browser   │   │
│  │  (Survivor) │                              │  (Rescuer)  │   │
│  └──────┬──────┘                              └──────┬──────┘   │
│         │                                            │           │
│         └────────────────┬───────────────────────────┘           │
│                          │                                       │
│                          ▼                                       │
│         ┌────────────────────────────────────────┐              │
│         │      React SPA (Frontend)               │              │
│         │  ┌──────────────────────────────────┐  │              │
│         │  │    React Router 6 (SPA)          │  │              │
│         │  │  ┌────────┬────────┬──────────┐ │  │              │
│         │  │  │ User   │ Rescue │ Warehouse│ │  │              │
│         │  │  │ Portal │ Portal │  Tracker │ │  │              │
│         │  │  └────────┴────────┴──────────┘ │  │              │
│         │  └──────────────────────────────────┘  │              │
│         │  ┌──────────────────────────────────┐  │              │
│         │  │   UI Components (Radix + Tailwind) │              │
│         │  └──────────────────────────────────┘  │              │
│         └────────────────┬───────────────────────┘              │
│                          │ HTTP/REST API                         │
│                          ▼                                       │
│         ┌────────────────────────────────────────┐              │
│         │      Express Server (Backend)          │              │
│         │  ┌──────────────────────────────────┐  │              │
│         │  │   API Routes (/api/*)            │  │              │
│         │  │  - /api/ping                     │  │              │
│         │  │  - /api/demo                     │  │              │
│         │  └──────────────────────────────────┘  │              │
│         │  ┌──────────────────────────────────┐  │              │
│         │  │   Middleware                     │  │              │
│         │  │  - CORS                          │  │              │
│         │  │  - Body Parser                   │  │              │
│         │  └──────────────────────────────────┘  │              │
│         └────────────────┬───────────────────────┘              │
│                          │ (Future)                              │
│                          ▼                                       │
│         ┌────────────────────────────────────────┐              │
│         │      Database Layer (Planned)          │              │
│         │  ┌──────────────────────────────────┐  │              │
│         │  │   PostgreSQL + PostGIS           │  │              │
│         │  │  - Users                         │  │              │
│         │  │  - Resources                     │  │              │
│         │  │  - Requests                      │  │              │
│         │  │  - Transactions                  │  │              │
│         │  └──────────────────────────────────┘  │              │
│         └────────────────────────────────────────┘              │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Architecture

### Component Hierarchy

```
App (Root)
├── QueryClientProvider (Tanstack Query)
├── TooltipProvider (Radix UI)
├── Toaster (Toast notifications)
├── Sonner (Alternative toast)
└── BrowserRouter (React Router)
    └── Layout
        ├── Header
        │   └── Link to Home (DRRMS logo)
        ├── Main (Routes)
        │   ├── Index (Landing)
        │   ├── UserPortal
        │   ├── RescuePortal
        │   ├── Report
        │   ├── Warehouse
        │   ├── UserResources (stub)
        │   ├── UserRescue (stub)
        │   └── NotFound (404)
        └── Footer
```

### Page Component Breakdown

#### Index Page (Landing)
```
Index
└── Section
    └── Grid (2 columns)
        ├── User Portal Card
        │   ├── Background Image
        │   ├── Overlay
        │   └── Button → /user
        └── Rescue Portal Card
            ├── Background Image
            ├── Overlay
            └── Button → /rescue
```

#### User Portal
```
UserPortal
└── Section
    └── Container
        └── Button Group (flex)
            ├── Button → /user/rescue
            ├── Button → /user/resources
            └── Button → /user/report
```

#### Report Page
```
Report
└── Section
    └── Container
        └── Form
            ├── Question 1: What happened? (textarea)
            ├── Question 2: Where? (input)
            ├── Question 3: Severity (button group)
            │   ├── Low
            │   ├── Moderate
            │   ├── High
            │   └── Critical
            ├── Question 4: When? (datetime-local)
            └── Submit Button
```

#### Rescue Portal
```
RescuePortal
└── Container
    └── Grid (3 columns)
        ├── Left Column (2 cols)
        │   ├── Notifications Panel
        │   │   └── Notification List
        │   └── Requests Panel
        │       └── Request Cards Grid
        │           ├── Request #1 (Pending)
        │           ├── Request #2 (Fulfilled)
        │           └── Request #3 (Rejected)
        └── Right Column (1 col)
            ├── Resource Overview
            │   ├── Available Resources: 100
            │   ├── People Needing Help: 35
            │   └── Progress Bar (80%)
            └── Action Panel
                └── Button → /warehouse
```

#### Warehouse Page
```
Warehouse
└── Container
    └── Grid (3 columns)
        ├── Left Column (2 cols)
        │   ├── Warehouse Overview
        │   │   ├── Warehouse Selector
        │   │   └── Resource Table
        │   │       ├── Water (100, 80, 20)
        │   │       ├── Food (500, 300, 200)
        │   │       ├── Medical Kits (200, 120, 80)
        │   │       ├── Blankets (400, 340, 60)
        │   │       └── Fuel (60, 30, 30)
        │   └── Stock Visualization
        │       └── Progress Bars
        │           ├── Water: 80%
        │           ├── Food: 60%
        │           ├── Medical: 60%
        │           ├── Blankets: 85%
        │           └── Fuel: 50%
        └── Right Column (1 col)
            └── Real-Time Tracking
                ├── Live Updates List
                └── Action Buttons
                    ├── Update Stock
                    └── Dispatch Resources
```

---

## 3. Routing Architecture

### Route Configuration

```typescript
Routes (React Router 6 - SPA Mode)
├── / (exact)              → Index
├── /user                  → UserPortal
├── /user/report           → Report
├── /user/resources        → UserResources
├── /user/rescue           → UserRescue
├── /rescue                → RescuePortal
├── /warehouse             → Warehouse
└── * (catch-all)          → NotFound
```

### Navigation Flow

```
Landing Page (/)
├── User Portal (/user)
│   ├── Rescue (/user/rescue)
│   ├── Resources (/user/resources)
│   └── Report (/user/report)
└── Rescue Portal (/rescue)
    └── Warehouse (/warehouse)
```

---

## 4. Backend Architecture

### Express Server Structure

```
Express Application
├── Middleware Stack
│   ├── CORS (cross-origin requests)
│   ├── express.json() (JSON parsing)
│   └── express.urlencoded() (form parsing)
├── API Routes
│   ├── GET /api/ping
│   │   └── Response: { message: env.PING_MESSAGE }
│   └── GET /api/demo
│       └── Response: { message: "Hello from Express server" }
└── Error Handling (planned)
```

### API Endpoint Structure

```
/api/
├── ping (GET)
│   Purpose: Health check
│   Response: { message: string }
│   Auth: None
│
└── demo (GET)
    Purpose: Example endpoint
    Response: DemoResponse
    Auth: None
```

---

## 5. Data Flow Architecture

### Current Data Flow (Static)

```
User Action
    ↓
Page Component
    ↓
Local State (useState)
    ↓
UI Update (re-render)
```

### Future Data Flow (With API)

```
User Action
    ↓
Event Handler
    ↓
API Call (fetch/axios)
    ↓
Express Server
    ↓
Route Handler
    ↓
Database Query (PostgreSQL)
    ↓
Response Data
    ↓
Tanstack Query Cache
    ↓
Component State Update
    ↓
UI Re-render
```

---

## 6. State Management Architecture

### Current State Management

```
Application State
├── React Context (Providers)
│   ├── QueryClientProvider (Tanstack Query)
│   └── TooltipProvider (Radix UI)
├── Component State (useState)
│   ├── Report: severity selection
│   └── Warehouse: warehouse selection
└── Custom Hooks
    ├── useToast (toast notifications)
    └── useMobile (responsive detection)
```

### Future State Management (Planned)

```
Application State
├── Global State
│   ├── Authentication (user session)
│   ├── User Profile
│   └── Settings
├── Server State (Tanstack Query)
│   ├── Resources
│   ├── Requests
│   ├── Notifications
│   └── Warehouse Data
├── UI State
│   ├── Modals/Dialogs
│   ├── Toasts
│   └── Loading States
└── Form State (React Hook Form)
    ├── Report Form
    ├── Request Form
    └── Resource Form
```

---

## 7. Build Architecture

### Development Build

```
pnpm dev
    ↓
Vite Dev Server (port 8080)
    ↓
┌─────────────────────────────────────┐
│  Frontend Build                      │
│  - Hot Module Replacement (HMR)     │
│  - TypeScript compilation (SWC)     │
│  - TailwindCSS processing           │
│  - React Fast Refresh               │
└─────────────────────────────────────┘
    ↓
Express Server Integration (middleware)
    ↓
┌─────────────────────────────────────┐
│  Backend Build                       │
│  - TypeScript execution (tsx)       │
│  - Auto-restart on file changes     │
└─────────────────────────────────────┘
```

### Production Build

```
pnpm build
    ↓
┌──────────────────────┐  ┌──────────────────────┐
│  pnpm build:client   │  │  pnpm build:server   │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           ▼                         ▼
    ┌─────────────┐          ┌──────────────┐
    │ Vite Build  │          │  Vite Build  │
    │   (client)  │          │   (server)   │
    └──────┬──────┘          └──────┬───────┘
           │                         │
           ▼                         ▼
    dist/spa/                 dist/server/
    ├── index.html           └── node-build.mjs
    └── assets/
        ├── index-*.css
        └── index-*.js
```

---

## 8. Styling Architecture

### TailwindCSS Configuration

```
Tailwind Processing
    ↓
PostCSS Pipeline
    ↓
┌────────────────────────────────┐
│  Base Layer (@layer base)      │
│  - CSS Variables              │
│  - Font Imports               │
│  - Global Resets              │
└────────────────────────────────┘
    ↓
┌────────────────────────────────┐
│  Components Layer              │
│  - Custom components (future) │
└────────────────────────────────┘
    ↓
┌────────────────────────────────┐
│  Utilities Layer               │
│  - Tailwind utilities         │
│  - Custom utilities (future)  │
└────────────────────────────────┘
    ↓
Optimized CSS Output
```

### Theme System

```
Theme Variables (CSS Custom Properties)
├── Light Mode (:root)
│   ├── --background: 0 0% 100%
│   ├── --foreground: 222.2 84% 4.9%
│   ├── --brand: 0 0% 0%
│   └── ... (more variables)
└── Dark Mode (.dark)
    ├── --background: 222.2 84% 4.9%
    ├── --foreground: 210 40% 98%
    └── ... (more variables)
    
Tailwind Config (tailwind.config.ts)
├── Colors (HSL from CSS variables)
│   ├── background: hsl(var(--background))
│   ├── brand: hsl(var(--brand))
│   └── ... (mapped from variables)
└── Utilities
    ├── border-border
    ├── bg-background
    └── text-foreground
```

---

## 9. Type System Architecture

### TypeScript Configuration

```
TypeScript Compilation
├── Compiler Options
│   ├── Target: ES2020
│   ├── Module: ESNext
│   ├── JSX: react-jsx
│   ├── Strict: false (learning mode)
│   └── ModuleResolution: bundler
├── Path Aliases
│   ├── @/* → client/*
│   └── @shared/* → shared/*
└── Include Patterns
    ├── client/**/*
    ├── server/**/*
    ├── shared/**/*
    └── *.config.ts
```

### Type Flow

```
Shared Types (shared/api.ts)
    ↓
┌──────────────────┬──────────────────┐
│                  │                  │
▼                  ▼                  ▼
Client Import    Server Import    Type Safety
@shared/api      @shared/api      Guaranteed
```

---

## 10. Testing Architecture

### Test Structure

```
Vitest Test Runner
    ↓
Test Files (*.spec.ts, *.test.tsx)
    ↓
┌──────────────────────────────────┐
│  Unit Tests                       │
│  - utils.spec.ts (cn function)   │
│  - Component tests (future)      │
└──────────────────────────────────┘
    ↓
┌──────────────────────────────────┐
│  Integration Tests (future)       │
│  - API endpoint tests            │
│  - Page routing tests            │
└──────────────────────────────────┘
    ↓
┌──────────────────────────────────┐
│  E2E Tests (future)               │
│  - User flows                    │
│  - Critical paths                │
└──────────────────────────────────┘
```

---

## 11. Deployment Architecture

### Current Deployment (Planned)

```
Source Code
    ↓
Build Process (pnpm build)
    ↓
┌─────────────────────────────────────┐
│  Build Artifacts                    │
│  ├── dist/spa/ (static files)       │
│  └── dist/server/ (Node.js server)  │
└─────────────────────────────────────┘
    ↓
Deployment Options
    ↓
┌──────────┬──────────┬──────────┐
│ Netlify  │  Vercel  │  Custom  │
└──────────┴──────────┴──────────┘
```

### Future Production Architecture

```
┌─────────────────────────────────────────────┐
│              Load Balancer                   │
└────────────────┬────────────────────────────┘
                 │
     ┌───────────┴───────────┐
     ▼                       ▼
┌──────────┐           ┌──────────┐
│  Server  │           │  Server  │
│ Instance │  ...      │ Instance │
│    #1    │           │    #N    │
└────┬─────┘           └────┬─────┘
     │                      │
     └──────────┬───────────┘
                ▼
        ┌───────────────┐
        │  PostgreSQL   │
        │   + PostGIS   │
        └───────────────┘
                ▼
        ┌───────────────┐
        │  Redis Cache  │
        │  (Sessions)   │
        └───────────────┘
```

---

## 12. Security Architecture (Planned)

### Authentication Flow (Future)

```
User Login
    ↓
Credentials Submitted
    ↓
Express Server
    ↓
Password Hash Check
    ↓
JWT Token Generated
    ↓
Token Sent to Client
    ↓
Stored in Memory/Cookie
    ↓
Attached to API Requests
    ↓
Server Validates Token
    ↓
Access Granted/Denied
```

### Authorization Levels (Planned)

```
User Roles
├── Survivor (User Portal)
│   ├── Submit reports
│   ├── Request resources
│   └── View status
└── Rescuer (Rescue Portal)
    ├── View all requests
    ├── Allocate resources
    ├── Manage warehouse
    └── Update request status
```

---

## 13. Performance Architecture

### Current Optimizations

```
Performance Features
├── Vite Build
│   ├── Code splitting (automatic)
│   ├── Tree shaking
│   ├── Minification
│   └── Gzip compression
├── React
│   ├── Component lazy loading (ready)
│   ├── Memo for expensive components
│   └── Virtual DOM diffing
└── TailwindCSS
    ├── PurgeCSS (unused styles removed)
    └── Minimal CSS output
```

### Future Optimizations (Planned)

```
Advanced Optimizations
├── Image Optimization
│   ├── WebP format
│   ├── Lazy loading
│   └── Responsive images
├── API Caching
│   ├── Tanstack Query cache
│   ├── Redis cache layer
│   └── CDN for static assets
├── Database Optimization
│   ├── Indexes on key columns
│   ├── Query optimization
│   └── Connection pooling
└── Monitoring
    ├── Performance metrics
    ├── Error tracking
    └── User analytics
```

---

## 14. Scalability Architecture (Future)

### Horizontal Scaling

```
Traffic Growth
    ↓
Load Balancer
    ↓
Multiple Server Instances
    ↓
Shared Database
    ↓
Cache Layer (Redis)
    ↓
Message Queue (for async tasks)
```

### Microservices (Long-term)

```
Monolith → Microservices Migration
    ↓
┌──────────────┬──────────────┬──────────────┐
│   Frontend   │   Auth       │   Resource   │
│   Service    │   Service    │   Service    │
└──────────────┴──────────────┴──────────────┘
       │              │              │
       └──────────────┴──────────────┘
                      ▼
              API Gateway
                      ▼
              Load Balancer
```

---

## 15. Provider Health Live Feed Architecture (Planned)

### Objectives

- Surface live status for logistics providers, NGOs, and third-party responders so dispatchers can trustfuly route work.
- Fuse multiple upstream feeds (synthetic pings, contractual SLAs, and staffing rosters) into a single, queryable signal.
- Stream the fused signal into the UI within <10s of change while storing an auditable history for transparency/analytics.

### Upstream Data Sources

| Source | Transport | Payload Highlights | Poll/Stream Cadence |
|--------|-----------|--------------------|---------------------|
| Status Pings | HTTPS/WebSocket probes managed by `provider-health-agent` | endpoint URL, response latency, HTTP status, optional synthetic transaction metrics | Every 30s (critical) / 2m (standard) with jitter |
| SLA Contracts | REST pull from vendor portals or S3 dropbox | target uptime, maintenance windows, degradation notices w/ timestamps | Refresh every 15m + webhook triggers |
| On-Call Rosters | PagerDuty/OpsGenie REST + webhook fan-in | shift owner, escalation chain, contact channels, shift start/end | Fetch hourly + instant webhook sync |

Each feed lands in an ingestion topic (Redis stream/Kafka partition) with a normalized envelope: `{ providerId, source, observedAt, payload }` to simplify downstream processing.

### Health Telemetry Service

```
Scheduler (BullMQ)
    ↓ (triggers)
collectStatusPings()  collectSLAWindows()  collectRosters()
    ↓                        ↓                   ↓
Normalization Layer (Zod schemas + hash-based idempotency)
    ↓
Provider Health Aggregator
    ├─ Computes rolling uptime %, SLA breaches, staffing coverage
    ├─ Persists snapshot + diff
    └─ Publishes real-time event → `provider-health:live` channel (SSE/WebSocket)
```

- **Storage**: new tables `provider_health_snapshots`, `provider_health_events`, and `provider_oncall_rosters` in Postgres (future PostGIS geometry column for coverage regions).
- **API Layer**: `/api/providers/health` (latest view, filterable) and `/api/providers/health/stream` (SSE) expose the data; both enforce rescuer/admin auth scopes.
- **Backfill**: hourly job compacts historical events into day-level aggregates for analytics dashboards.

### Frontend Surfaces

- **Health Cards Grid** (Rescue Portal sidebar): one card per provider showing signal lights (green/amber/red), uptime %, current SLA tier, roster contact (tap-to-call). Cards subscribe to the SSE channel and optimistically update TanStack Query cache.
- **Map Overlay** (ResourcesPage + RescuePortal map mode): providers with geographic coverage render as polygons colored by health state; degradations pulse with a subtle animation and tooltips include latest SLA notice + on-call owner.
- **Alert Banner + Activity Feed**: when a provider enters `degraded` or `critical`, a Sonner toast and timeline entry appear referencing the transparency ledger hash for the event (keeps auditability aligned with blockchain-backed transparency goals).

### Operational Considerations

- **Graceful Degradation**: if streaming drops, UI falls back to 30s HTTP poll; backend marks each snapshot with `freshness_state` so stale data is obvious.
- **Testing Hooks**: local dev can stub feeds via `pnpm dev --provider-stubs` which replays canned payloads into the aggregator for UI work without real vendors.
- **Observability**: metrics exported (`provider_health_ingest_latency_ms`, `provider_health_stream_clients`) feed into Prometheus/Grafana for NOC visibility.

### Local Smoke Test

1. `pnpm db:migrate && pnpm db:seed` – migrations plus seeding now call the provider health ingestor so Postgres already has fresh snapshots/events when the app boots.
2. `pnpm dev` – start the combined Vite + Express stack on `http://localhost:8080`.
3. In a new terminal, log in as the seeded rescuer (`rescuer@drrms.org` / `password123`) or admin (`admin@drrms.org` / `adminSecure123`) to grab a JWT:
     ```bash
     curl -s -X POST http://localhost:8080/api/auth/login \
         -H "Content-Type: application/json" \
         -d '{"email":"rescuer@drrms.org","password":"password123"}'
     ```
     Copy the `token` field from the response.
4. Stream the SSE feed with that token (Authorization header or `?token=` query both work):
     ```bash
     curl -N -H "Authorization: Bearer YOUR_TOKEN" \
         http://localhost:8080/api/providers/health/stream
     ```
     You should immediately see a bootstrap payload (thanks to seeding) followed by periodic `provider-health` events and 25s heartbeats.

This architecture keeps the provider health feature isolated yet composable with the rest of DRRMS: ingestion jobs live alongside other schedulers, data persists in Postgres (extendable to PostGIS), and the UI consumes the same typed contracts shared in `@shared/api`.

---

## Architecture Principles

### Current Principles
1. **Separation of Concerns**: Client, server, and shared code clearly separated
2. **Type Safety**: TypeScript throughout
3. **Component Reusability**: UI component library
4. **Developer Experience**: Fast HMR, clear structure
5. **Accessibility**: Radix UI primitives

### Future Principles
6. **Scalability**: Horizontal scaling ready
7. **Security**: JWT auth, RBAC
8. **Offline-First**: PWA capabilities
9. **Real-Time**: WebSocket integration
10. **Observability**: Logging, monitoring, tracing

---

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend Framework | React 18 | Industry standard, rich ecosystem |
| Build Tool | Vite | Fast HMR, modern tooling |
| Styling | TailwindCSS | Utility-first, rapid development |
| UI Components | Radix UI | Accessible, unstyled |
| Routing | React Router 6 | SPA mode, declarative |
| Backend | Express | Minimal, flexible |
| Language | TypeScript | Type safety, better DX |
| Package Manager | pnpm | Fast, efficient |
| Testing | Vitest | Vite-native, fast |

---

## Conclusion

This architecture is designed for:
- **Current**: Rapid prototyping and learning
- **Near-term**: Production deployment with basic features
- **Long-term**: Scalable disaster relief platform

The architecture is intentionally modular to allow gradual complexity increase as the team gains experience.

---

**Last Updated**: October 2025