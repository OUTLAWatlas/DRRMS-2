# DRRMS Feature Roadmap & API Specification

## Feature Implementation Roadmap

This document outlines the planned features for DRRMS across multiple development phases.

---

## Phase 1: Core Foundation ✅ (CURRENT)

### Completed Features

#### 1. Project Setup
- [x] Repository structure
- [x] Build system (Vite)
- [x] Development environment
- [x] TypeScript configuration
- [x] Testing framework (Vitest)
- [x] Package management (pnpm)

#### 2. Frontend Foundation
- [x] React 18 setup
- [x] React Router 6 (SPA mode)
- [x] TailwindCSS integration
- [x] Radix UI component library
- [x] Layout component (Header/Footer)
- [x] Landing page
- [x] Responsive design

#### 3. User Portal (Survivor Side)
- [x] User Portal dashboard
- [x] Disaster Report form (functional)
  - [x] What happened (textarea)
  - [x] Location input
  - [x] Severity selection (Low/Moderate/High/Critical)
  - [x] Timestamp input
  - [x] Form validation
- [x] Navigation structure

#### 4. Rescue Portal (Rescuer Side)
- [x] Rescue Portal dashboard
- [x] Notifications panel (static)
- [x] Request cards display (static)
- [x] Resource overview panel
- [x] Progress indicators

#### 5. Warehouse Management
- [x] Warehouse selector
- [x] Resource inventory table
- [x] Stock level visualizations
- [x] Real-time tracking panel (UI only)

#### 6. Backend Foundation
- [x] Express server setup
- [x] CORS configuration
- [x] Basic API endpoints (/api/ping, /api/demo)
- [x] Middleware setup

---

## Phase 2: Backend Integration 🚧 (NEXT)

### Database Setup

#### PostgreSQL Integration
- [ ] Database schema design
- [ ] PostgreSQL installation/setup
- [ ] Connection pooling
- [ ] Migration system
- [ ] Seed data

#### Core Tables
```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'survivor' or 'rescuer'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Resources table
CREATE TABLE resources (
  id SERIAL PRIMARY KEY,
  type VARCHAR(100) NOT NULL, -- 'Water', 'Food', 'Medical Kits', etc.
  quantity INTEGER NOT NULL,
  warehouse_id INTEGER REFERENCES warehouses(id),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Disaster Reports table
CREATE TABLE disaster_reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  what_happened TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  severity VARCHAR(50) NOT NULL, -- 'Low', 'Moderate', 'High', 'Critical'
  occurred_at TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Rescue Requests table
CREATE TABLE rescue_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  location VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  urgency VARCHAR(50) NOT NULL,
  people_count INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Resource Allocations table
CREATE TABLE resource_allocations (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES rescue_requests(id),
  resource_id INTEGER REFERENCES resources(id),
  quantity INTEGER NOT NULL,
  allocated_by INTEGER REFERENCES users(id),
  allocated_at TIMESTAMP DEFAULT NOW()
);

-- Warehouses table
CREATE TABLE warehouses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints to Implement

#### Authentication APIs
```typescript
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

#### User APIs
```typescript
GET    /api/users/:id
PUT    /api/users/:id
DELETE /api/users/:id
```

#### Disaster Report APIs
```typescript
POST   /api/reports              // Create disaster report
GET    /api/reports              // List all reports (rescuer only)
GET    /api/reports/:id          // Get single report
PUT    /api/reports/:id          // Update report
DELETE /api/reports/:id          // Delete report
```

#### Rescue Request APIs
```typescript
POST   /api/rescue-requests      // Create rescue request
GET    /api/rescue-requests      // List rescue requests
GET    /api/rescue-requests/:id  // Get single request
PUT    /api/rescue-requests/:id  // Update request status
```

#### Resource APIs
```typescript
GET    /api/resources            // List all resources
GET    /api/resources/:id        // Get single resource
POST   /api/resources            // Add resource
PUT    /api/resources/:id        // Update resource
DELETE /api/resources/:id        // Delete resource
```

#### Warehouse APIs
```typescript
GET    /api/warehouses           // List all warehouses
GET    /api/warehouses/:id       // Get warehouse details
GET    /api/warehouses/:id/inventory  // Get warehouse inventory
POST   /api/warehouses/:id/resources  // Add resource to warehouse
```

#### Allocation APIs
```typescript
POST   /api/allocations          // Allocate resource to request
GET    /api/allocations          // List all allocations
GET    /api/allocations/:id      // Get single allocation
```

### Authentication & Authorization
- [ ] JWT token generation
- [ ] Password hashing (bcrypt)
- [ ] Protected routes middleware
- [ ] Role-based access control (RBAC)
- [ ] Session management

---

## Phase 3: Dynamic Features 🔮

### Frontend Enhancements

#### Complete Stub Pages
- [ ] User Resources page
  - [ ] Display available resources by category
  - [ ] Filter by warehouse location
  - [ ] Request specific resources
- [ ] User Rescue page
  - [ ] Rescue request form
  - [ ] Track request status
  - [ ] Real-time updates

#### Form Enhancements
- [ ] React Hook Form integration
- [ ] Real-time validation
- [ ] Error handling
- [ ] Success notifications
- [ ] Loading states

#### Data Fetching
- [ ] Tanstack Query setup
- [ ] API client configuration
- [ ] Cache management
- [ ] Optimistic updates
- [ ] Pagination

#### Dashboard Improvements
- [ ] Real data from API
- [ ] Charts and graphs (Recharts)
- [ ] Real-time notifications
- [ ] Search and filtering
- [ ] Sorting

### Backend Enhancements
- [ ] Request validation (Zod)
- [ ] Error handling middleware
- [ ] Logging system
- [ ] Rate limiting
- [ ] API documentation (Swagger)

---

## Phase 4: Advanced Features 🚀

### Geolocation & Mapping
- [ ] PostGIS setup for spatial queries
- [ ] Interactive maps (Mapbox/Leaflet)
- [ ] Location-based resource allocation
- [ ] Distance calculations
- [ ] Heat maps for disaster zones
- [ ] Route optimization

### Prioritization Engine
- [ ] Criticality scoring algorithm
  ```
  Score = (Severity Weight × Severity Value) +
          (Time Weight × Time Since Report) +
          (Population Weight × People Affected) +
          (Distance Weight × Distance to Resources)
  ```
- [ ] Automated resource allocation
- [ ] Queue management
- [ ] Priority re-calculation

### Real-Time Features
- [ ] WebSocket integration
- [ ] Live status updates
- [ ] Real-time notifications
- [ ] Live dashboard updates
- [ ] Chat/messaging system

### Analytics & Reporting
- [ ] Dashboard analytics
- [ ] Resource utilization reports
- [ ] Response time metrics
- [ ] Success rate tracking
- [ ] Export to CSV/PDF

---

## Phase 5: Production Ready 🎯

### Security Hardening
- [ ] Input sanitization
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF tokens
- [ ] Rate limiting
- [ ] API key management
- [ ] Security headers
- [ ] Audit logging

### Performance Optimization
- [ ] Database indexing
- [ ] Query optimization
- [ ] Redis caching
- [ ] CDN integration
- [ ] Image optimization
- [ ] Code splitting
- [ ] Lazy loading
- [ ] Service worker (PWA)

### Testing
- [ ] Unit tests (80%+ coverage)
- [ ] Integration tests
- [ ] E2E tests (Playwright/Cypress)
- [ ] Performance testing
- [ ] Security testing
- [ ] Load testing

### DevOps
- [ ] Docker containerization
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Automated deployments
- [ ] Environment management
- [ ] Monitoring (Prometheus/Grafana)
- [ ] Error tracking (Sentry)
- [ ] Log aggregation

---

## Phase 6: AI & ML Integration 🤖

### Predictive Analytics
- [ ] Demand forecasting
- [ ] Resource requirement prediction
- [ ] Disaster pattern analysis
- [ ] Optimal warehouse placement
- [ ] Route optimization ML model

### Natural Language Processing
- [ ] Automatic report categorization
- [ ] Sentiment analysis
- [ ] Multilingual support
- [ ] Voice-to-text for reports

### Computer Vision
- [ ] Damage assessment from images
- [ ] Aerial imagery analysis
- [ ] Crowd density estimation

---

## Phase 7: Blockchain Integration ⛓️

### Transparency Features
- [ ] Immutable allocation records
- [ ] Donation tracking
- [ ] Supply chain verification
- [ ] Smart contracts for automation
- [ ] Transparent audit trails

---

## Phase 8: Offline & Mobile 📱

### Progressive Web App (PWA)
- [ ] Service worker setup
- [ ] Offline functionality
- [ ] Background sync
- [ ] Push notifications
- [ ] App manifest
- [ ] Install prompts

### Mobile Optimization
- [ ] Responsive design (already done)
- [ ] Touch gestures
- [ ] Mobile-first UI
- [ ] Native app (React Native)

### Offline-First Architecture
- [ ] Local database (IndexedDB)
- [ ] Sync when online
- [ ] Conflict resolution
- [ ] Queue for offline actions

---

## API Specification (Planned)

### API Response Format

#### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation successful",
  "timestamp": "2025-10-20T13:40:00Z"
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  },
  "timestamp": "2025-10-20T13:40:00Z"
}
```

### Authentication

All authenticated endpoints require:
```http
Authorization: Bearer <JWT_TOKEN>
```

### Endpoint Details

#### POST /api/auth/register

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "role": "survivor", // or "rescuer"
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "role": "survivor",
      "name": "John Doe"
    },
    "token": "jwt_token_here"
  }
}
```

#### POST /api/auth/login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "role": "survivor"
    },
    "token": "jwt_token_here"
  }
}
```

#### POST /api/reports

**Request:**
```json
{
  "what_happened": "Severe flooding in downtown area",
  "location": "123 Main St, City",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "severity": "High",
  "occurred_at": "2025-10-20T12:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "what_happened": "Severe flooding in downtown area",
    "location": "123 Main St, City",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "severity": "High",
    "occurred_at": "2025-10-20T12:00:00Z",
    "status": "pending",
    "created_at": "2025-10-20T13:40:00Z"
  }
}
```

#### GET /api/reports

**Query Parameters:**
- `status` - Filter by status (pending, in_progress, resolved)
- `severity` - Filter by severity (Low, Moderate, High, Critical)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "id": 1,
        "user_id": 1,
        "what_happened": "Severe flooding",
        "location": "123 Main St",
        "severity": "High",
        "status": "pending",
        "created_at": "2025-10-20T13:40:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "totalPages": 5
    }
  }
}
```

#### POST /api/rescue-requests

**Request:**
```json
{
  "location": "456 Oak Ave, City",
  "latitude": 40.7580,
  "longitude": -73.9855,
  "urgency": "Critical",
  "people_count": 5,
  "description": "Family trapped on second floor"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "location": "456 Oak Ave, City",
    "urgency": "Critical",
    "people_count": 5,
    "status": "pending",
    "created_at": "2025-10-20T13:40:00Z"
  }
}
```

#### GET /api/resources

**Query Parameters:**
- `warehouse_id` - Filter by warehouse
- `type` - Filter by resource type

**Response:**
```json
{
  "success": true,
  "data": {
    "resources": [
      {
        "id": 1,
        "type": "Water",
        "quantity": 100,
        "warehouse": {
          "id": 1,
          "name": "Mumbai Warehouse"
        },
        "updated_at": "2025-10-20T13:40:00Z"
      }
    ]
  }
}
```

#### POST /api/allocations

**Request:**
```json
{
  "request_id": 1,
  "resources": [
    {
      "resource_id": 1,
      "quantity": 10
    },
    {
      "resource_id": 2,
      "quantity": 5
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "allocation": {
      "id": 1,
      "request_id": 1,
      "resources": [
        {
          "resource_id": 1,
          "type": "Water",
          "quantity": 10
        }
      ],
      "allocated_by": 2,
      "allocated_at": "2025-10-20T13:40:00Z"
    }
  }
}
```

---

## Error Codes

| Code | Message | HTTP Status |
|------|---------|-------------|
| AUTH_REQUIRED | Authentication required | 401 |
| INVALID_CREDENTIALS | Invalid email or password | 401 |
| FORBIDDEN | Access forbidden | 403 |
| NOT_FOUND | Resource not found | 404 |
| VALIDATION_ERROR | Validation failed | 400 |
| SERVER_ERROR | Internal server error | 500 |
| RESOURCE_UNAVAILABLE | Resource not available | 409 |

---

## WebSocket Events (Phase 4)

### Client → Server

```typescript
// Subscribe to updates
socket.emit('subscribe', { type: 'requests' });

// Unsubscribe
socket.emit('unsubscribe', { type: 'requests' });
```

### Server → Client

```typescript
// New request created
socket.on('request:created', (data) => {
  // Handle new request
});

// Request status updated
socket.on('request:updated', (data) => {
  // Handle update
});

// Resource allocated
socket.on('allocation:created', (data) => {
  // Handle allocation
});
```

---

## Rate Limits (Phase 5)

| Endpoint | Limit | Window |
|----------|-------|--------|
| /api/auth/login | 5 requests | 15 minutes |
| /api/auth/register | 3 requests | 1 hour |
| /api/reports | 10 requests | 1 minute |
| /api/rescue-requests | 5 requests | 1 minute |
| /api/* (general) | 100 requests | 1 minute |

---

## Implementation Priority

### High Priority (Phase 2)
1. Database setup
2. Authentication
3. Report submission API
4. Rescue request API
5. Resource viewing API

### Medium Priority (Phase 3)
1. Real data integration
2. Complete stub pages
3. Form improvements
4. Search/filter
5. Pagination

### Low Priority (Phase 4+)
1. Geolocation
2. Real-time features
3. Analytics
4. AI/ML
5. Blockchain

---

**Last Updated**: October 2025  
**Document Version**: 1.0
