# ClinicManagement — Enterprise Clinic/Health Center Management System

## Project Overview

A multi-tenant, enterprise-grade clinic and health center management platform built with:
- **Backend**: Python 3.11+ / FastAPI / SQLAlchemy / Celery
- **Frontend**: React 18 / TypeScript / Redux Toolkit / Tailwind CSS
- **Mobile**: React Native / Expo SDK 50+
- **Database**: PostgreSQL 15 (Azure Database for PostgreSQL Flexible Server)
- **Cache**: Redis 7 (Azure Cache for Redis)
- **Queue**: Celery + Azure Service Bus
- **Storage**: Azure Blob Storage
- **Auth**: Azure AD B2C + JWT (RS256)
- **Infra**: Azure Kubernetes Service (AKS) + Terraform + GitHub Actions

---

## Repository Structure

```
ClinicManagement/
├── CLAUDE.md                        # This file
├── README.md
├── docker-compose.yml               # Local dev environment
├── docker-compose.test.yml          # Test environment
├── .env.example                     # Environment variable template
├── .gitignore
│
├── backend/                         # FastAPI Python backend
│   ├── app/
│   │   ├── main.py                  # FastAPI application entry point
│   │   ├── core/
│   │   │   ├── config.py            # Settings (Pydantic BaseSettings)
│   │   │   ├── database.py          # SQLAlchemy engine + session
│   │   │   ├── security.py          # JWT, password hashing, RBAC
│   │   │   ├── middleware.py        # Tenant resolution, logging, CORS
│   │   │   ├── exceptions.py        # Custom exception handlers
│   │   │   ├── dependencies.py      # FastAPI dependency injection
│   │   │   └── cache.py             # Redis client wrapper
│   │   ├── models/                  # SQLAlchemy ORM models
│   │   │   ├── base.py              # Base model with audit fields
│   │   │   ├── tenant.py            # Tenant (clinic group)
│   │   │   ├── user.py              # Users + roles
│   │   │   ├── clinic.py            # Clinic/branch
│   │   │   ├── doctor.py            # Doctor profiles + schedules
│   │   │   ├── patient.py           # Patient demographics + history
│   │   │   ├── appointment.py       # Appointments + waitlist
│   │   │   ├── medical_record.py    # EMR/EHR records
│   │   │   ├── prescription.py      # Digital prescriptions
│   │   │   ├── lab_report.py        # Lab orders + results
│   │   │   ├── billing.py           # Invoices, payments, insurance
│   │   │   ├── inventory.py         # Pharmacy/supply inventory
│   │   │   └── notification.py      # Notification logs
│   │   ├── schemas/                 # Pydantic request/response schemas
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── router.py        # Main API router
│   │   │       ├── auth.py          # Authentication endpoints
│   │   │       ├── tenants.py       # Tenant management
│   │   │       ├── clinics.py       # Clinic CRUD
│   │   │       ├── doctors.py       # Doctor management + schedules
│   │   │       ├── patients.py      # Patient management
│   │   │       ├── appointments.py  # Appointment booking system
│   │   │       ├── medical_records.py
│   │   │       ├── prescriptions.py
│   │   │       ├── lab_reports.py
│   │   │       ├── billing.py
│   │   │       ├── inventory.py
│   │   │       ├── notifications.py
│   │   │       ├── analytics.py
│   │   │       ├── telemedicine.py
│   │   │       └── files.py         # Document upload/download
│   │   ├── services/                # Business logic layer
│   │   ├── repositories/            # Data access layer (Repository pattern)
│   │   ├── tasks/                   # Celery async tasks
│   │   └── utils/                   # Helpers, validators
│   ├── migrations/                  # Alembic database migrations
│   ├── tests/                       # pytest test suite
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── Dockerfile
│
├── frontend/                        # React TypeScript web app
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/              # Reusable UI components
│   │   ├── pages/                   # Route-level page components
│   │   ├── store/                   # Redux Toolkit slices
│   │   ├── services/                # API client (Axios + React Query)
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── utils/                   # Helpers
│   │   └── types/                   # TypeScript type definitions
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── Dockerfile
│
├── mobile/                          # React Native / Expo patient app
│   ├── src/
│   │   ├── screens/                 # Screen components
│   │   ├── navigation/              # React Navigation config
│   │   ├── components/              # Reusable components
│   │   ├── store/                   # Redux Toolkit
│   │   ├── services/                # API + offline sync
│   │   ├── hooks/
│   │   └── utils/
│   ├── app.json
│   ├── package.json
│   └── eas.json                     # Expo Application Services config
│
├── infrastructure/
│   ├── terraform/                   # Azure infrastructure as code
│   │   ├── environments/
│   │   │   ├── dev/
│   │   │   ├── staging/
│   │   │   └── production/
│   │   └── modules/
│   ├── kubernetes/                  # K8s manifests (Kustomize)
│   │   ├── base/
│   │   └── overlays/
│   └── scripts/                     # Deployment scripts
│
└── .github/
    └── workflows/                   # CI/CD pipelines
        ├── ci-backend.yml
        ├── ci-frontend.yml
        ├── ci-mobile.yml
        └── cd-azure.yml
```

---

## Architecture Decisions

### Multi-Tenancy
- **Strategy**: Row-Level Security (RLS) in PostgreSQL + application-level tenant filtering
- **Tenant Resolution**: HTTP header `X-Tenant-ID` OR subdomain (e.g., `cityhealth.app.com`)
- **Isolation**: Each tenant's data is filtered by `tenant_id` on every query; RLS policies enforce this at the DB level
- **Tenant Hierarchy**: Platform → Tenant (clinic group) → Clinic (branch) → Staff/Patients

### Authentication & Authorization
- **Mechanism**: JWT (RS256) with refresh token rotation
- **Roles**: `super_admin`, `tenant_admin`, `clinic_admin`, `doctor`, `nurse`, `receptionist`, `pharmacist`, `lab_technician`, `patient`
- **RBAC**: Permission matrix stored in DB; evaluated via dependency injection on every route
- **Patient Auth**: Separate auth flow via OTP (phone/email) + social login

### Database Design Principles
- Every table has: `id` (UUID), `tenant_id`, `created_at`, `updated_at`, `created_by`, `is_deleted` (soft delete)
- All foreign keys reference within same tenant
- PostgreSQL RLS policies on all tables
- Encrypted columns (PGP) for: SSN, insurance IDs, sensitive medical fields

### API Design
- REST API versioned at `/api/v1/`
- All responses: `{ success, data, message, meta }` envelope
- Pagination: cursor-based for feeds, offset for admin lists
- Rate limiting: per-tenant, per-user via Redis
- OpenAPI docs at `/docs` (development only)

### File Storage
- All files stored in Azure Blob Storage
- Pre-signed URLs for uploads/downloads (1-hour expiry)
- Files organized: `{tenant_id}/{entity_type}/{entity_id}/{filename}`
- Virus scanning on upload via Azure Defender

### Async Processing (Celery Tasks)
- Appointment reminders (24h, 2h before)
- Lab result notifications
- Prescription renewal alerts
- Invoice generation
- Report generation
- Email/SMS sending
- Analytics aggregation

---

## Key Modules & Features

### 1. Tenant Management
- Onboard new clinic groups (tenants)
- Subscription plans (Basic, Professional, Enterprise)
- Feature flags per tenant
- Tenant-level settings and branding

### 2. Clinic/Branch Management
- Multiple branches per tenant
- Branch-specific settings (working hours, holidays, services)
- Room/bay management
- Equipment tracking

### 3. Doctor Management
- Doctor profiles (qualifications, specializations, experience)
- Schedule templates (weekly recurring)
- Exception scheduling (holidays, leaves)
- Availability slots with configurable duration
- Multi-clinic doctors (doctor works at multiple branches)
- Locum/substitute doctors

### 4. Patient Management
- Comprehensive registration (demographics, contacts, insurance)
- Medical history (allergies, chronic conditions, past surgeries)
- Family linking (parents/children/spouse)
- Patient portal access
- Consent management
- GDPR/HIPAA data handling

### 5. Appointment System
- Real-time slot availability
- Online booking (web + mobile)
- Walk-in registration
- Recurring appointments
- Waitlist with auto-promotion
- Cancellation policy enforcement
- Double-booking prevention (pessimistic locking)
- Emergency override
- Multi-doctor appointments (e.g., surgery team)
- Video/telemedicine appointments

### 6. EMR/EHR
- SOAP notes (Subjective, Objective, Assessment, Plan)
- ICD-10 diagnosis coding
- CPT procedure codes
- Vital signs tracking
- Allergy management
- Medication reconciliation
- Clinical decision support alerts

### 7. Prescriptions
- Digital prescription creation
- Drug database integration
- Drug-drug interaction warnings
- Drug-allergy conflict detection
- E-prescription (HL7 FHIR compatible)
- Refill requests + approval workflow
- Controlled substance tracking

### 8. Lab Reports
- Lab order creation
- Sample collection tracking
- External lab integration
- Result entry + critical value alerting
- Trend visualization
- Auto-notification on results

### 9. Billing & Payments
- Fee schedule management
- Insurance claim generation
- Co-pay / self-pay handling
- Invoice PDF generation
- Payment gateway integration (Stripe/Razorpay)
- Insurance pre-authorization
- Accounts receivable aging
- EOB (Explanation of Benefits) processing

### 10. Pharmacy & Inventory
- Drug catalog management
- Stock management with reorder alerts
- Dispensing workflow
- Expiry tracking
- Supplier management
- Purchase orders

### 11. Telemedicine
- WebRTC video calls (Azure Communication Services)
- Virtual waiting room
- Screen sharing for reports
- Session recording (with consent)
- Post-consultation summary

### 12. Analytics & Reporting
- Operational dashboards (appointments, revenue, no-shows)
- Clinical dashboards (diagnoses, procedures)
- Financial reports (P&L, AR aging, insurance claims)
- Custom report builder
- Export to CSV/Excel/PDF

### 13. Notifications
- In-app notifications
- Push notifications (FCM for Android, APNs for iOS)
- Email (Azure Communication Services / SendGrid)
- SMS (Azure Communication Services / Twilio)
- WhatsApp Business API (optional)
- Notification preferences per user

---

## Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| Double booking | Pessimistic row lock during slot reservation |
| Doctor calls in sick | Bulk rescheduling + patient notifications |
| Power/internet outage | Mobile offline mode with sync queue |
| Insurance rejection | Claim re-submission workflow |
| Drug interaction | Real-time alert on prescription creation |
| Critical lab values | Immediate alert to ordering doctor + auto escalation |
| Patient no-show | Configurable charge + slot release to waitlist |
| Timezone differences | All times stored UTC, displayed in clinic/user timezone |
| Concurrent slot booking | Optimistic locking + retry |
| Expired prescriptions | Auto-expiry + refill request workflow |
| Data breach detection | Audit log anomaly detection + auto-lock |
| Minor patient (< 18) | Consent from guardian required |
| Deceased patient | Soft-lock with access log |
| Duplicate patient records | Fuzzy matching + merge workflow |
| HIPAA data request | Automated patient data export |

---

## Development Setup

### Prerequisites
- Docker & Docker Compose
- Python 3.11+
- Node.js 20+
- Azure CLI
- Terraform 1.7+

### Quick Start (Local)

```bash
# Clone repo
git clone <repo-url>
cd ClinicManagement

# Copy environment files
cp .env.example .env
# Edit .env with your local values

# Start all services
docker-compose up -d

# Backend: run migrations
cd backend
pip install -r requirements-dev.txt
alembic upgrade head
python scripts/seed_data.py  # Seeds demo tenant + admin user

# Frontend
cd ../frontend
npm install
npm run dev  # http://localhost:5173

# Mobile
cd ../mobile
npm install
npx expo start
```

### Running Tests

```bash
# Backend tests
cd backend
pytest --cov=app --cov-report=html

# Frontend tests
cd frontend
npm test

# E2E tests
cd tests/e2e
npx playwright test
```

---

## Environment Variables

See `.env.example` for all required variables. Key groups:

- `DATABASE_*` — PostgreSQL connection
- `REDIS_*` — Redis connection
- `AZURE_*` — Azure services (Storage, AD B2C, Communication)
- `JWT_*` — JWT signing keys
- `CELERY_*` — Task queue config
- `STRIPE_*` — Payment processing
- `SENDGRID_*` — Email delivery
- `TWILIO_*` — SMS delivery

---

## Deployment (Azure)

```bash
# Infrastructure provisioning
cd infrastructure/terraform/environments/production
terraform init
terraform plan -out=tfplan
terraform apply tfplan

# Deploy backend
kubectl apply -k infrastructure/kubernetes/overlays/production

# Build & push Docker images (done via CI/CD)
# See .github/workflows/cd-azure.yml
```

---

## API Documentation

- Development: `http://localhost:8000/docs` (Swagger UI)
- Staging: `https://api-staging.clinicapp.com/docs`
- Production: Disabled (security); use Postman collection at `docs/postman/`

---

## HIPAA Compliance Checklist

- [x] Encryption at rest (Azure Storage + PG TDE)
- [x] Encryption in transit (TLS 1.3)
- [x] Access control (RBAC + MFA)
- [x] Audit logging (all PHI access logged)
- [x] Data backup (geo-redundant, daily)
- [x] Business Associate Agreements (BAA) with Azure
- [x] Minimum necessary access principle
- [x] PHI de-identification for analytics
- [x] Data retention policies
- [x] Breach notification workflow

---

## Code Conventions

### Python (Backend)
- Style: Black + isort + flake8
- Type hints required on all functions
- Async-first (use `async def` for all route handlers and DB calls)
- Repository pattern for DB access (no ORM queries in routes)
- Service layer for business logic
- Dependency injection via FastAPI `Depends()`

### TypeScript (Frontend & Mobile)
- Style: ESLint + Prettier
- Strict TypeScript (`strict: true`)
- Feature-based folder structure
- React Query for server state; Redux Toolkit for UI state
- Custom hooks to encapsulate business logic

### Git Workflow
- Branch naming: `feature/CMS-123-description`, `fix/CMS-456-description`
- PR requires: 2 approvals + passing CI
- Commit style: Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
- Protected branches: `main`, `staging`

---

## Contacts & Resources

- Architecture decisions: `docs/adr/`
- API changelog: `CHANGELOG.md`
- Runbooks: `docs/runbooks/`
- Postman collection: `docs/postman/clinic-management.postman_collection.json`
