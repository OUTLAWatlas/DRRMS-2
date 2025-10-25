# DRRMS Quick Start Guide

## 🚀 Get Started in 5 Minutes

This guide will get you up and running with the DRRMS (Disaster Relief Resource Management System) project quickly.

---

## Prerequisites

Before you begin, make sure you have:

- **Node.js** 18+ installed ([Download here](https://nodejs.org/))
- **Git** installed ([Download here](https://git-scm.com/))
- A code editor (VS Code recommended)

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/OUTLAWatlas/DRRMS.git
cd DRRMS/frontend
```

### 2. Install pnpm (Package Manager)

```bash
npm install -g pnpm@10.14.0
```

### 3. Install Dependencies

```bash
pnpm install
```

---

## Running the Application

### Development Mode

Start the development server with hot reload:

```bash
pnpm dev
```

The application will be available at: **http://localhost:8080**

- Frontend and backend run on the same port (8080)
- Changes to code automatically reload in the browser
- Server restarts automatically on backend changes

### What You'll See

1. **Landing Page** (http://localhost:8080)
   - Two portal options: User Portal and Rescue Portal

2. **User Portal** (http://localhost:8080/user)
   - Options: Rescue, Resources, Report Disaster

3. **Rescue Portal** (http://localhost:8080/rescue)
   - Dashboard with notifications and requests

---

## Project Commands

### Essential Commands

```bash
# Start development server
pnpm dev

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Format code
pnpm format.fix

# Build for production
pnpm build

# Start production server
pnpm start
```

---

## Project Structure

```
DRRMS/
├── frontend/
│   ├── client/              # React frontend
│   │   ├── pages/          # Page components
│   │   ├── components/     # Reusable components
│   │   └── hooks/          # Custom React hooks
│   ├── server/             # Express backend
│   │   └── routes/         # API endpoints
│   └── shared/             # Shared types
└── Readme.md
```

---

## Available Pages

| URL | Page | Description |
|-----|------|-------------|
| `/` | Landing | Portal selection (User/Rescue) |
| `/user` | User Portal | Survivor dashboard |
| `/user/report` | Report | Disaster reporting form |
| `/user/rescue` | Request Rescue | (Placeholder) |
| `/user/resources` | View Resources | (Placeholder) |
| `/rescue` | Rescue Portal | Rescuer dashboard |
| `/warehouse` | Warehouse | Resource inventory tracker |

---

## Making Your First Change

### Example: Edit the Landing Page

1. Open `frontend/client/pages/Index.tsx`

2. Find the button text:
```tsx
USER PORTAL
```

3. Change it to:
```tsx
SURVIVOR PORTAL
```

4. Save the file - the browser will automatically reload!

---

## Adding a New Page

### Step 1: Create the Page Component

Create `frontend/client/pages/MyPage.tsx`:

```tsx
export default function MyPage() {
  return (
    <section className="py-16">
      <div className="container text-center">
        <h2 className="text-3xl font-bold">My New Page</h2>
        <p className="text-muted-foreground">
          This is my custom page!
        </p>
      </div>
    </section>
  );
}
```

### Step 2: Add the Route

Edit `frontend/client/App.tsx`:

```tsx
import MyPage from "./pages/MyPage";

// Add to Routes:
<Route path="/my-page" element={<MyPage />} />
```

### Step 3: Test It

Visit: http://localhost:8080/my-page

---

## Adding an API Endpoint

### Step 1: Create Route Handler

Create `frontend/server/routes/hello.ts`:

```typescript
import { RequestHandler } from "express";

export const handleHello: RequestHandler = (req, res) => {
  res.json({ message: "Hello, DRRMS!" });
};
```

### Step 2: Register Route

Edit `frontend/server/index.ts`:

```typescript
import { handleHello } from "./routes/hello";

// Add to createServer function:
app.get("/api/hello", handleHello);
```

### Step 3: Test It

Visit: http://localhost:8080/api/hello

---

## Using UI Components

The project includes 50+ pre-built UI components from Radix UI.

### Example: Add a Button

```tsx
import { Button } from "@/components/ui/button";

function MyComponent() {
  return (
    <Button onClick={() => alert("Clicked!")}>
      Click Me
    </Button>
  );
}
```

### Example: Add a Card

```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resource Status</CardTitle>
      </CardHeader>
      <CardContent>
        <p>100 units available</p>
      </CardContent>
    </Card>
  );
}
```

### Available Components

See `frontend/client/components/ui/` for all available components:
- Button, Input, Textarea, Select
- Card, Alert, Toast
- Dialog, Sheet, Popover
- Tabs, Accordion, Collapsible
- And 40+ more!

---

## Styling with TailwindCSS

### Basic Classes

```tsx
<div className="flex items-center justify-center p-4">
  <h1 className="text-3xl font-bold text-center">
    Title
  </h1>
</div>
```

### Common Patterns

```tsx
// Container
<div className="container mx-auto">

// Card
<div className="rounded-lg border bg-white p-6">

// Button
<button className="rounded-lg bg-black text-white px-4 py-2">

// Grid
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">

// Responsive
<div className="text-sm md:text-base lg:text-lg">
```

---

## Working with Forms

### Basic Form

```tsx
function MyForm() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    console.log(Object.fromEntries(data.entries()));
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" required className="border rounded px-3 py-2" />
      <button type="submit" className="bg-black text-white px-4 py-2">
        Submit
      </button>
    </form>
  );
}
```

---

## Testing

### Run Tests

```bash
pnpm test
```

### Write a Test

Create `myFunction.spec.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "./myFunction";

describe("myFunction", () => {
  it("should return expected value", () => {
    expect(myFunction(2, 3)).toBe(5);
  });
});
```

---

## Environment Variables

### Client-Side Variables

In `.env`:
```env
VITE_PUBLIC_API_KEY=your_key_here
```

Access in code:
```typescript
const apiKey = import.meta.env.VITE_PUBLIC_API_KEY;
```

### Server-Side Variables

In `.env`:
```env
DATABASE_URL=postgres://localhost/drrms
```

Access in code:
```typescript
const dbUrl = process.env.DATABASE_URL;
```

---

## Troubleshooting

### Port Already in Use

If port 8080 is in use, change it in `vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    port: 3000,  // Change to any available port
  },
});
```

### Module Not Found

Clear cache and reinstall:
```bash
rm -rf node_modules
pnpm install
```

### TypeScript Errors

Run type check to see all errors:
```bash
pnpm typecheck
```

### Build Fails

Clean and rebuild:
```bash
rm -rf dist
pnpm build
```

---

## Next Steps

### For Beginners
1. Explore the existing pages in `client/pages/`
2. Modify some text and see the changes
3. Add a simple page
4. Try using different UI components

### For Intermediate Developers
1. Complete the stub pages (UserResources, UserRescue)
2. Add form validation with React Hook Form
3. Create new API endpoints
4. Add client-side data fetching with Tanstack Query

### For Advanced Developers
1. Integrate PostgreSQL database
2. Implement authentication with JWT
3. Add real-time features with WebSockets
4. Build the resource allocation algorithm

---

## Learning Resources

### Official Documentation
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [React Router](https://reactrouter.com)
- [Radix UI](https://www.radix-ui.com)

### Project Documentation
- `Readme.md` - Project overview
- `CODEBASE_DOCUMENTATION.md` - Complete code reference
- `ARCHITECTURE.md` - Technical architecture
- `frontend/AGENTS.md` - Fusion Starter guide

---

## Getting Help

### Common Issues

**Problem**: Changes not reflecting
- **Solution**: Make sure dev server is running (`pnpm dev`)
- Check browser console for errors

**Problem**: TypeScript errors
- **Solution**: Run `pnpm typecheck` to see all errors
- Check type definitions in `tsconfig.json`

**Problem**: Can't find a component
- **Solution**: Check `client/components/ui/` directory
- Import from `@/components/ui/component-name`

---

## Building for Production

### Create Production Build

```bash
pnpm build
```

Output files:
- `dist/spa/` - Frontend static files
- `dist/server/` - Backend server

### Run Production Server

```bash
pnpm start
```

Server runs on port 8080 (configurable).

---

## Development Tips

### 1. Use the Browser DevTools
- **React DevTools**: Inspect component tree
- **Network Tab**: Monitor API calls
- **Console**: Check for errors and logs

### 2. Keep the Dev Server Running
- Hot reload saves time
- Immediate feedback on changes

### 3. Use TypeScript
- Let the editor show you errors
- Use autocomplete for faster coding

### 4. Follow the Existing Patterns
- Look at existing components
- Copy structure and adapt

### 5. Test Early and Often
- Write tests as you code
- Run `pnpm test` frequently

---

## Code Organization Tips

### File Naming
- Components: `PascalCase.tsx` (e.g., `UserPortal.tsx`)
- Utilities: `camelCase.ts` (e.g., `utils.ts`)
- Tests: `*.spec.ts` or `*.test.tsx`

### Import Organization
```typescript
// 1. External imports
import { useState } from "react";
import { Link } from "react-router-dom";

// 2. Internal imports
import { Button } from "@/components/ui/button";
import { myUtil } from "@/lib/utils";

// 3. Relative imports
import { LocalComponent } from "./LocalComponent";
```

### Component Structure
```typescript
// 1. Imports
import { useState } from "react";

// 2. Type definitions
interface Props {
  title: string;
}

// 3. Component
export default function MyComponent({ title }: Props) {
  // 4. Hooks
  const [count, setCount] = useState(0);
  
  // 5. Handlers
  const handleClick = () => setCount(count + 1);
  
  // 6. Render
  return (
    <div>
      <h1>{title}</h1>
      <button onClick={handleClick}>{count}</button>
    </div>
  );
}
```

---

## Keyboard Shortcuts (VS Code)

- `Ctrl/Cmd + P` - Quick file open
- `Ctrl/Cmd + Shift + F` - Search in all files
- `Ctrl/Cmd + B` - Toggle sidebar
- `Ctrl/Cmd + \`` - Toggle terminal
- `F2` - Rename symbol

---

## Git Workflow

### Commit Your Changes

```bash
# See what changed
git status

# Add changes
git add .

# Commit with message
git commit -m "Add my feature"

# Push to remote
git push
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────┐
│           DRRMS Quick Reference              │
├─────────────────────────────────────────────┤
│ Start dev server:    pnpm dev               │
│ Run tests:           pnpm test              │
│ Build:               pnpm build             │
│ Type check:          pnpm typecheck         │
│                                             │
│ Dev server:          http://localhost:8080  │
│                                             │
│ Add page:            client/pages/          │
│ Add component:       client/components/     │
│ Add API route:       server/routes/         │
│                                             │
│ Import from client:  @/path/to/file        │
│ Import shared:       @shared/api           │
└─────────────────────────────────────────────┘
```

---

## Congratulations! 🎉

You're now ready to start developing with DRRMS!

**Remember**:
- Start with small changes
- Save frequently (auto-reload is your friend)
- Check the console for errors
- Ask for help when stuck
- Have fun building!

---

**Happy Coding!** 👨‍💻👩‍💻

For detailed documentation, see:
- `CODEBASE_DOCUMENTATION.md` - Complete reference
- `ARCHITECTURE.md` - Technical architecture
- `Readme.md` - Project overview
