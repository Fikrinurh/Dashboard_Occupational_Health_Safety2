# OHS EXPERT – Occupational Health & Safety Management System

A full-stack enterprise web application for Occupational Health Monitoring, Medical Examination Management, Workplace Accident Reporting, Root Cause Analysis (Five Whys & Interactive 6M Fishbone Diagram), Corrective and Preventive Action (CAPA) Governance, and Management Verification.

## Architecture & Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Recharts, Lucide React, React Router, React Hook Form, Zod, jsPDF
- **Backend**: Node.js, Express.js REST API, JWT authentication (`jsonwebtoken`), `bcryptjs` password hashing, `multer` secure file uploads
- **Database**: MySQL 8.0 via `mysql2/promise` connection pool (supports local MySQL and Google Cloud SQL for MySQL via Unix socket or TCP)

## Database Modes (MySQL vs. Demo Store)

- **Production / MySQL Mode**: When `DB_HOST` (or `CLOUD_SQL_CONNECTION_NAME`) is configured in `.env` and reachable, the server connects directly to MySQL using parameterized queries (`server/db/mysqlRepository.ts`).
- **Demo Store Mode**: When no MySQL credentials are configured, the server runs transparently in `DEMO_STORE` mode (`server/db/demoStore.ts`) with deterministic seed data persisted locally to `server/data/demo-db.json` so all workflows can be evaluated without an external MySQL daemon. The active database mode is reported by `GET /api/system/status` and displayed in the sidebar footer.

## Setup & Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and configure your secrets and MySQL connection:

```bash
cp .env.example .env
```

Key variables in `.env`:
- `JWT_SECRET`: Strong random secret for signing JWT tokens.
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: Standard MySQL server credentials.
- `CLOUD_SQL_CONNECTION_NAME`: Optional Google Cloud SQL instance connection name (e.g., `project:region:instance`).

### 3. Initialize MySQL Schema & Seed Data

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

### 4. Run in Development or Production

```bash
# Development (Express + Vite middleware on port 3000)
npm run dev

# Run unit tests
npm test

# Type-check and build for production
npm run lint
npm run build
npm start
```

## Role-Based Access Control (RBAC)

Authorization is enforced server-side on all REST endpoints:

- **ADMIN** (`admin@ohsexpert.io` / `OhsExpert2026!`): Full access, user management, companies/locations master data, configurable clinical reference ranges.
- **HSE_OFFICER** (`hse@ohsexpert.io` / `OhsExpert2026!`): Clinic visit logging, medical examinations, workplace accident reporting, investigations, Five Whys, 6M Fishbone RCA, CAPA creation/updates, evidence uploads.
- **MANAGEMENT** (`management@ohsexpert.io` / `OhsExpert2026!`): Monitoring dashboard, incident/investigation review, CAPA verification (Approve/Reject/Reopen), and final incident closure approval.

## Key Modules

1. **Monitoring Dashboard (`/`)**: 3-section color-coded vertical filter panel, Clinic Visits analytics, Medical Examinations (BMI, Glucose, Cholesterol, Uric Acid), Workplace Accidents with anatomical body-part mapping, workflow KPIs, and Incident Monitoring Table.
2. **Input Dashboard (`/input`)**: Tabbed operational forms with automatic BMI calculation (`Weight / Height²`) and CRUD operations.
3. **Investigations & RCA (`/investigations`)**: Investigation chronology, Five Whys chain, interactive visual 6M Ishikawa Fishbone diagram, evidence gallery, and incident closure gate.
4. **CAPA & Verification (`/capa`)**: CAPA tracking with automatic overdue detection, completion evidence uploads, management verification modal, and audit trail.
5. **Reports (`/reports`)**: CSV export, printable layouts, and downloadable PDF reports.
