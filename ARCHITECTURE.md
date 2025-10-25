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
