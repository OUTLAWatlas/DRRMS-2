# DRRMS Codebase Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Key Components](#key-components)
6. [Pages & Routing](#pages--routing)
7. [API & Backend](#api--backend)
8. [Styling System](#styling-system)
9. [Development Workflow](#development-workflow)
10. [Build & Deployment](#build--deployment)

---

## Project Overview

**DRRMS (Disaster Relief Resource Management System)** is an internet-based platform designed to optimize the allocation and deployment of critical resources during natural and man-made disasters.

### Core Purpose
- Enable efficient resource allocation during disasters
- Provide real-time communication between survivors and rescuers
- Minimize delays with automated prioritization of critical needs
- Ensure transparency and accountability in relief operations

### Dual Portal System

#### 🆘 Survivor Portal (User Portal)
For disaster-affected individuals to:
- Request rescue assistance
- Report disasters with severity levels
- View available resources
- Track relief status

#### 🧑‍🚒 Rescuer Portal (Rescue Portal)
For relief agencies, NGOs, and government authorities to:
- Allocate and track resources
- Manage resource requests
- Monitor warehouse inventory
- View dashboard notifications

---

## Architecture

### High-Level Architecture

The system follows a **full-stack monorepo architecture** with clear separation between client and server:

```
┌─────────────────────────────────────────────────┐
│              DRRMS Application                   │
├─────────────────────────────────────────────────┤
│  Frontend (React SPA)                            │
│  - React 18 + TypeScript                        │
│  - React Router 6 (SPA mode)                     │
│  - TailwindCSS + Radix UI                       │
│  - Tanstack Query (data fetching)               │
├─────────────────────────────────────────────────┤
│  Backend (Express Server)                        │
│  - Express 5                                     │
│  - REST API endpoints                            │
│  - Integrated with Vite dev server              │
├─────────────────────────────────────────────────┤
│  Shared Types & Utilities                        │
│  - TypeScript interfaces                         │
│  - API contracts                                 │
└─────────────────────────────────────────────────┘
```

### Design Patterns
- **Component-Based Architecture**: React components with clear separation of concerns
- **Single Page Application (SPA)**: Client-side routing with React Router
- **Monorepo Structure**: Client, server, and shared code in single repository
- **Type-Safe Communication**: Shared TypeScript interfaces between client/server
- **Hot Module Replacement**: Full hot reload for both client and server during development

---

## Tech Stack

### Frontend
- **React 18.3.1** - Component-based UI library
- **React Router 6.30.1** - Client-side routing (SPA mode)
- **TypeScript 5.9.2** - Type safety and developer experience
- **Vite 7.1.2** - Build tool and dev server
- **TailwindCSS 3.4.17** - Utility-first CSS framework
- **Radix UI** - Accessible, unstyled UI primitives
- **Lucide React 0.539.0** - Icon library
- **Tanstack Query 5.84.2** - Data fetching and state management
- **React Hook Form 7.62.0** - Form handling
- **Framer Motion 12.23.12** - Animation library

### Backend
- **Express 5.1.0** - Node.js web framework
- **CORS 2.8.5** - Cross-origin resource sharing
- **dotenv 17.2.1** - Environment variable management

### Development Tools
- **Vitest 3.2.4** - Unit testing framework
- **Prettier 3.6.2** - Code formatting
- **pnpm 10.14.0** - Package manager
- **tsx 4.20.3** - TypeScript execution

### UI Component Libraries
- **Radix UI Components**: Accordion, Alert Dialog, Avatar, Checkbox, Dialog, Dropdown Menu, Popover, Select, Slider, Switch, Tabs, Toast, Tooltip, and more
- **ShadCN UI Components**: Custom-styled Radix components
- **class-variance-authority 0.7.1** - Component variant management
- **tailwind-merge 2.6.0** - Tailwind class merging utility

---

## Project Structure

```
DRRMS/
├── Readme.md                    # Project overview and documentation
└── frontend/                    # Main application directory
    ├── client/                  # Frontend React application
    │   ├── App.tsx             # Application entry point with routing
    │   ├── global.css          # Global styles and TailwindCSS config
    │   ├── components/         # React components
    │   │   ├── Layout.tsx      # Main layout wrapper (header/footer)
    │   │   └── ui/             # UI component library (50+ components)
    │   ├── pages/              # Route page components
    │   │   ├── Index.tsx       # Landing page (portal selection)
    │   │   ├── UserPortal.tsx  # User portal dashboard
    │   │   ├── RescuePortal.tsx # Rescue portal dashboard
    │   │   ├── Report.tsx      # Disaster reporting form
    │   │   ├── Warehouse.tsx   # Warehouse resource tracker
    │   │   ├── UserResources.tsx # User resources view (stub)
    │   │   ├── UserRescue.tsx  # User rescue request (stub)
    │   │   └── NotFound.tsx    # 404 page
    │   ├── hooks/              # Custom React hooks
    │   │   ├── use-mobile.tsx  # Mobile detection hook
    │   │   └── use-toast.ts    # Toast notification hook
    │   └── lib/                # Utility functions
    │       ├── utils.ts        # Utility functions (cn for class merging)
    │       └── utils.spec.ts   # Unit tests for utilities
    ├── server/                 # Backend Express application
    │   ├── index.ts            # Server setup and middleware
    │   ├── node-build.ts       # Production server entry point
    │   └── routes/             # API route handlers
    │       └── demo.ts         # Example API route
    ├── shared/                 # Shared types between client/server
    │   └── api.ts              # API interface definitions
    ├── public/                 # Static assets
    │   ├── favicon.ico
    │   ├── placeholder.svg
    │   └── robots.txt
    ├── package.json            # Dependencies and scripts
    ├── tsconfig.json           # TypeScript configuration
    ├── vite.config.ts          # Vite client configuration
    ├── vite.config.server.ts   # Vite server build configuration
    ├── tailwind.config.ts      # Tailwind CSS configuration
    ├── postcss.config.js       # PostCSS configuration
    ├── components.json         # ShadCN UI configuration
    ├── .env                    # Environment variables
    ├── .gitignore              # Git ignore rules
    ├── .prettierrc             # Prettier configuration
    └── AGENTS.md               # Fusion Starter documentation
```

---

## Key Components

### Layout Component (`client/components/Layout.tsx`)
Main application wrapper providing consistent structure across all pages:
- **Header**: DRRMS branding with home link
- **Main Content Area**: Renders child components (pages)
- **Footer**: Copyright and project information

### UI Component Library (`client/components/ui/`)
50+ pre-built, accessible UI components based on Radix UI:
- **Form Components**: Input, Textarea, Checkbox, Radio Group, Select, Switch, Slider
- **Feedback Components**: Alert, Alert Dialog, Toast, Sonner, Progress
- **Navigation**: Tabs, Accordion, Navigation Menu, Breadcrumb, Menubar
- **Overlays**: Dialog, Sheet, Drawer, Popover, Tooltip, Hover Card, Context Menu
- **Data Display**: Card, Table, Avatar, Badge, Separator, Skeleton
- **Layout**: Resizable Panels, Scroll Area, Collapsible, Aspect Ratio

### Custom Hooks

#### `use-mobile.tsx`
Detects mobile viewport for responsive behavior.

#### `use-toast.ts`
Manages toast notification state and provides toast triggering functions.

---

## Pages & Routing

### Routing Configuration (`client/App.tsx`)
The application uses React Router 6 in SPA mode with the following routes:

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Index | Landing page with portal selection |
| `/user` | UserPortal | User portal dashboard with 3 options |
| `/user/report` | Report | Disaster reporting form |
| `/user/resources` | UserResources | View available resources (stub) |
| `/user/rescue` | UserRescue | Request rescue (stub) |
| `/rescue` | RescuePortal | Rescuer dashboard |
| `/warehouse` | Warehouse | Warehouse resource tracker |
| `*` | NotFound | 404 error page |

### Page Details

#### 1. **Index Page** (`pages/Index.tsx`)
**Purpose**: Landing page for portal selection

**Features**:
- Split-screen design with two large buttons
- Left side: USER PORTAL with family image
- Right side: RESCUE PORTAL with firefighter image
- Responsive grid layout (stacks on mobile)

**Navigation**:
- User Portal → `/user`
- Rescue Portal → `/rescue`

---

#### 2. **User Portal** (`pages/UserPortal.tsx`)
**Purpose**: Central hub for disaster survivors

**Features**:
- Three main action buttons:
  - **RESCUE**: Request emergency rescue
  - **RESOURCES**: View available resources
  - **REPORT DISASTER**: Submit disaster report
- Full-screen background image
- Centered button layout (responsive)

**Navigation**:
- RESCUE → `/user/rescue`
- RESOURCES → `/user/resources`
- REPORT DISASTER → `/user/report`

---

#### 3. **Report Page** (`pages/Report.tsx`)
**Purpose**: Disaster reporting form for survivors

**Features**:
- **4-step form**:
  1. What happened? (textarea)
  2. Where did it occur? (text input for address)
  3. Severity level (Low, Moderate, High, Critical buttons)
  4. When did it occur? (datetime-local input)
- Form validation (all fields required)
- Severity selection with visual feedback
- Numbered steps with circular badges
- Submit button logs data to console and shows alert

**State Management**:
- `severity` state for tracking selected severity level
- Hidden input for severity value in form

**Styling**:
- Black background with white form card
- Rounded inputs with black borders
- Active severity button highlighted in black

---

#### 4. **Rescue Portal** (`pages/RescuePortal.tsx`)
**Purpose**: Dashboard for rescue coordinators

**Features**:
- **Latest Notifications Panel**:
  - Recent request submissions
  - Status change notifications
  - New request alerts
  
- **Requests Panel**:
  - Grid of request cards
  - Request ID and description
  - Status badges (Pending, Fulfilled, Rejected)
  - Color-coded status indicators
  
- **Resource Overview Panel**:
  - Available resources count (100)
  - People needing help (35)
  - Resources required vs fulfilled (80% progress bar)
  - Auto-update notification
  - Link to Warehouse Tracker

**Layout**:
- 3-column responsive grid (2 cols for main content, 1 for sidebar)
- Stacks vertically on mobile

**Sample Data**:
- Request #REQ1023 (Flood in downtown) - Pending
- Request #REQ1019 (Road blocked) - Fulfilled
- Request #REQ1018 (Building on fire) - Rejected

---

#### 5. **Warehouse Page** (`pages/Warehouse.tsx`)
**Purpose**: Resource inventory tracking for rescuers

**Features**:
- **Warehouse Selector**: Dropdown to switch between warehouses (Mumbai, Pune, Delhi)
  
- **Resource Overview Table**:
  - Columns: Resource Type, Stock Available, Distributed, Remaining
  - Resources tracked:
    - Water: 100 stock, 80 available, 20 distributed
    - Food: 500 stock, 300 available, 200 distributed
    - Medical Kits: 200 stock, 120 available, 80 distributed
    - Blankets: 400 stock, 340 available, 60 distributed
    - Fuel: 60 stock, 30 available, 30 distributed
  
- **Stock Level Visualization**:
  - Progress bars for each resource
  - Percentage calculations
  - Visual stock level indicators
  - "View History" button
  
- **Real-Time Tracking Panel**:
  - Live updates (simulated):
    - Incoming deliveries
    - Outgoing distributions
    - Low stock alerts
  - Action buttons:
    - "Update Stock"
    - "Dispatch Resources"

**Layout**:
- 3-column grid (2 cols main, 1 col sidebar)
- Responsive table with overflow scroll

---

#### 6. **User Resources** (`pages/UserResources.tsx`)
**Status**: Stub/Placeholder

**Future Purpose**:
- Display available resources to survivors
- Show stock levels
- Request specific resources

---

#### 7. **User Rescue** (`pages/UserRescue.tsx`)
**Status**: Stub/Placeholder

**Future Purpose**:
- Request rescue form
- Track rescue request status
- Real-time updates

---

## API & Backend

### Server Configuration (`server/index.ts`)

**Middleware**:
- CORS enabled for cross-origin requests
- JSON body parsing
- URL-encoded form parsing

**API Endpoints**:

#### 1. `GET /api/ping`
**Purpose**: Health check endpoint

**Response**:
```json
{
  "message": "ping pong"  // From PING_MESSAGE env variable
}
```

#### 2. `GET /api/demo`
**Purpose**: Example API endpoint

**Response**:
```typescript
{
  message: "Hello from Express server"
}
```

**Handler**: `server/routes/demo.ts`

### Shared Types (`shared/api.ts`)

Type-safe API contracts shared between client and server:

```typescript
export interface DemoResponse {
  message: string;
}
```

### Development Server Integration

During development (`pnpm dev`):
- Vite dev server runs on port 8080
- Express app integrated as Vite middleware
- Single port for both frontend and backend
- Hot reload for both client and server code

### Production Server (`server/node-build.ts`)

Production server entry point for running the built application.

---

## Styling System

### TailwindCSS Configuration

**Theme Customization** (`tailwind.config.ts`):
- Custom color palette with HSL values
- Responsive container with centered layout
- Custom animations (accordion)
- Sidebar-specific color system
- Border radius variables

**Colors Defined**:
- `background`, `foreground` - Base colors
- `primary`, `secondary` - Brand colors
- `muted`, `accent` - Secondary UI colors
- `destructive` - Error/warning states
- `card`, `popover` - Surface colors
- `brand` - DRRMS brand color (black)
- `sidebar` - Sidebar-specific palette

### Global Styles (`client/global.css`)

**Features**:
- Google Fonts import (Inter font family)
- TailwindCSS layers (base, components, utilities)
- CSS variables for theming
- Dark mode support (`.dark` class)
- Consistent border styling
- Background/foreground inheritance

**Theme Variables**:
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --brand: 0 0% 0%;
  --brand-foreground: 0 0% 100%;
  /* ... more variables */
}
```

### Utility Function (`lib/utils.ts`)

**`cn()` function**:
- Combines `clsx` and `tailwind-merge`
- Conditionally applies class names
- Handles Tailwind class conflicts
- Supports object notation

**Usage**:
```typescript
className={cn(
  "base-classes",
  { "conditional-class": condition },
  props.className
)}
```

---

## Development Workflow

### Installation

```bash
# Install pnpm globally
npm install -g pnpm@10.14.0

# Install dependencies
cd frontend
pnpm install
```

### Development Commands

```bash
# Start development server (port 8080)
pnpm dev

# Run tests
pnpm test

# TypeScript type checking
pnpm typecheck

# Format code with Prettier
pnpm format.fix

# Build for production
pnpm build

# Build client only
pnpm build:client

# Build server only
pnpm build:server

# Start production server
pnpm start
```

### File Watching & Hot Reload

During development:
- **Client code** (`client/`): Full HMR (Hot Module Replacement)
- **Server code** (`server/`): Automatic restart on file changes
- **Shared code** (`shared/`): Updates trigger rebuild

### Path Aliases

TypeScript path aliases configured in `tsconfig.json`:

```typescript
// Import from client directory
import { Component } from '@/components/Component';

// Import from shared directory
import { ApiType } from '@shared/api';
```

### Environment Variables

Configuration in `.env`:
```env
VITE_PUBLIC_BUILDER_KEY=__BUILDER_PUBLIC_KEY__
PING_MESSAGE="ping pong"
```

**Access in code**:
- Client: `import.meta.env.VITE_PUBLIC_BUILDER_KEY`
- Server: `process.env.PING_MESSAGE`

---

## Build & Deployment

### Build Process

**Client Build** (`pnpm build:client`):
1. Vite builds React application
2. Output: `dist/spa/` directory
3. Generates:
   - `index.html` - Entry HTML file
   - `assets/index-*.css` - Bundled styles (~62KB, ~11KB gzipped)
   - `assets/index-*.js` - Bundled JavaScript (~320KB, ~102KB gzipped)

**Server Build** (`pnpm build:server`):
1. Vite builds server code
2. Output: `dist/server/` directory
3. Generates:
   - `node-build.mjs` - Production server entry point (~1.5KB)

### Production Deployment

**Standard Deployment**:
```bash
pnpm build
pnpm start
```

**Cloud Deployment Options**:
- **Netlify**: Configured via `netlify.toml`
- **Vercel**: Compatible with Vercel deployment
- **AWS/GCP**: Future planned deployment

**Deployment Artifacts**:
- `dist/spa/` - Static client files
- `dist/server/` - Server bundle

### Testing

**Test Framework**: Vitest 3.2.4

**Test Files**:
- `client/lib/utils.spec.ts` - Utility function tests

**Test Coverage**:
- `cn()` function tests (5 test cases)
  - Class merging
  - Conditional classes
  - Null/false handling
  - Tailwind class deduplication
  - Object notation

**Run Tests**:
```bash
pnpm test
```

---

## Current Implementation Status

### ✅ Implemented Features

1. **Routing & Navigation**
   - SPA routing with React Router 6
   - All main routes configured
   - Layout component with header/footer

2. **User Portal**
   - Landing page with portal selection
   - User portal dashboard
   - Disaster reporting form (functional)
   - Form validation and submission

3. **Rescue Portal**
   - Dashboard with notifications
   - Request management (static data)
   - Resource overview panel
   - Link to warehouse tracker

4. **Warehouse Management**
   - Resource inventory table
   - Stock level visualizations
   - Warehouse selector (Mumbai, Pune, Delhi)
   - Real-time tracking panel (UI only)

5. **UI Component Library**
   - 50+ pre-built components
   - Radix UI integration
   - TailwindCSS styling
   - Dark mode support

6. **Backend**
   - Express server setup
   - Basic API endpoints
   - CORS configuration
   - Development/production modes

7. **Development Tooling**
   - TypeScript configuration
   - Vite build system
   - Vitest testing
   - Prettier formatting
   - Hot reload (client & server)

### 🚧 Stub/Placeholder Features

1. **User Resources Page**
   - Currently displays placeholder text
   - Intended to show available resources

2. **User Rescue Page**
   - Currently displays placeholder text
   - Intended for rescue request form

### 📋 Planned Features (From Readme)

**Future Semesters**:
1. Real-time data integration (weather APIs, government feeds)
2. AI-powered predictive allocation
3. Blockchain for transparency
4. Offline-first capability
5. Geospatial mapping with heatmaps
6. PostgreSQL database integration
7. Dynamic scoring and prioritization engine
8. Authentication system (JWT)
9. Role-based access control
10. Celery + Redis for background jobs

---

## Key Insights & Design Decisions

### 1. **Monorepo Architecture**
- **Why**: Simplifies development with shared types
- **Benefit**: Type-safe communication between client/server
- **Trade-off**: Slightly more complex build process

### 2. **SPA vs. SSR**
- **Choice**: Single Page Application (SPA)
- **Why**: Simpler deployment, better offline support (future)
- **Future**: Could migrate to SSR for better SEO

### 3. **Vite over Webpack**
- **Why**: Faster dev server, better DX
- **Benefit**: Near-instant HMR
- **Compatible**: Easy migration to other tools if needed

### 4. **Radix UI**
- **Why**: Accessibility-first, unstyled components
- **Benefit**: Full design control with TailwindCSS
- **Learning Curve**: Developers need to understand Radix patterns

### 5. **Static Data (Current)**
- **Status**: All data is hardcoded
- **Next Step**: Replace with API calls
- **Migration Path**: Use Tanstack Query for data fetching

### 6. **No Database Yet**
- **Current**: No persistence layer
- **Planned**: PostgreSQL with PostGIS
- **When**: Future semester implementation

### 7. **Form Handling**
- **Current**: Basic form submission with console.log
- **Tools Available**: React Hook Form installed but not used
- **Next Step**: Integrate with backend API

---

## Contributing Guidelines

### Code Style
- **Formatting**: Prettier with default config
- **TypeScript**: Strict mode disabled for easier learning
- **Naming**: camelCase for variables, PascalCase for components
- **Files**: `.tsx` for React components, `.ts` for utilities

### Component Structure
```typescript
// Component with props
interface ComponentProps {
  // Props definition
}

export default function Component({ }: ComponentProps) {
  // Hooks
  // State
  // Effects
  // Handlers
  
  return (
    // JSX
  );
}
```

### Adding New Features

**New Page**:
1. Create component in `client/pages/`
2. Add route in `client/App.tsx`
3. Add navigation link in relevant component

**New API Endpoint**:
1. Create handler in `server/routes/`
2. Register in `server/index.ts`
3. (Optional) Add type in `shared/api.ts`

**New UI Component**:
- Use existing components from `client/components/ui/`
- Add custom components to `client/components/`

---

## Troubleshooting

### Common Issues

**Port 8080 in use**:
```bash
# Change port in vite.config.ts
server: {
  port: 3000  // Change to different port
}
```

**Build fails**:
```bash
# Clear cache and reinstall
rm -rf node_modules dist
pnpm install
pnpm build
```

**TypeScript errors**:
```bash
# Run type check
pnpm typecheck
```

**Tests failing**:
```bash
# Run tests in watch mode
pnpm vitest
```

---

## Future Roadmap

### Semester 1 (Current)
- ✅ Project structure and routing
- ✅ Basic UI implementation
- ✅ Form handling (Report page)
- ✅ Static data display
- 🚧 Complete stub pages
- 🚧 Add authentication
- 🚧 Database integration
- 🚧 API implementation

### Semester 2+
- Real-time features
- Resource allocation algorithm
- AI-powered predictions
- Geospatial mapping
- Offline support
- Blockchain integration
- Advanced security

---

## Resources & Documentation

### Official Documentation
- [React Documentation](https://react.dev)
- [React Router](https://reactrouter.com)
- [TailwindCSS](https://tailwindcss.com)
- [Radix UI](https://www.radix-ui.com)
- [Vite](https://vitejs.dev)
- [Express](https://expressjs.com)

### Project-Specific
- `Readme.md` - Project overview and objectives
- `frontend/AGENTS.md` - Fusion Starter documentation
- This document - Complete codebase reference

### Team Contacts
- Frontend: Arrnav Pawar, Mahendra Patil
- Backend: Krishna Patil
- Documentation: Saumya Patil
- Institution: Vishwakarma Institute of Technology (VIT Pune)

---

## License

MIT License - Free to use, modify, and distribute with attribution.

---

**Document Version**: 1.0  
**Last Updated**: October 2025  
**Maintained By**: DRRMS Development Team
