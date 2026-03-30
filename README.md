# ClinicManagement

Enterprise-grade, multi-tenant clinic and health center management platform.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | Python 3.11 · FastAPI · SQLAlchemy 2.0 · Celery |
| Frontend | React 18 · TypeScript · Redux Toolkit · Tailwind CSS · Vite |
| Mobile | React Native · Expo SDK 51 · React Navigation |
| Database | PostgreSQL 15 (Azure Flexible Server) |
| Cache / Queue | Redis 7 · Celery + Azure Service Bus |
| Storage | Azure Blob Storage |
| Auth | Azure AD B2C · JWT RS256 · OTP (patients) |
| Infra | AKS · Terraform · GitHub Actions |

## Features

- **Multi-tenancy** — Row-Level Security + tenant middleware (header / subdomain)
- **Appointment System** — Real-time slots, double-booking prevention (distributed lock), waitlist auto-promotion
- **EMR / EHR** — SOAP notes, ICD-10, CPT, vital signs, medication reconciliation
- **Prescriptions** — Drug-allergy & drug-drug interaction checks, e-prescription (FHIR), refill workflows
- **Lab Reports** — Critical value alerting, trend visualisation, auto-notification
- **Billing** — Insurance claims, invoice PDF generation, payment gateway integration
- **Pharmacy** — FEFO dispensing, expiry tracking, low-stock alerts
- **Telemedicine** — WebRTC video (Azure Communication Services), virtual waiting room
- **Analytics** — Operational dashboards, revenue reports, doctor performance KPIs
- **Notifications** — In-app, push (FCM / APNs), email (SendGrid), SMS (Twilio)
- **HIPAA Compliance** — Audit logging, encrypted fields, data retention, BAA-ready

## Quick Start

```bash
# Clone
git clone <repo-url>
cd ClinicManagement
cp .env.example .env

# Start infrastructure
docker-compose up -d

# Backend
cd backend
pip install -r requirements-dev.txt
alembic upgrade head
python scripts/seed_data.py
uvicorn app.main:app --reload

# Frontend
cd ../frontend
npm install
npm run dev          # http://localhost:5173

# Mobile
cd ../mobile
npm install
npx expo start
```

## Running Tests

```bash
# Backend
cd backend
pytest --cov=app --cov-report=html -v

# Frontend
cd frontend
npm test

# E2E
cd tests/e2e
npx playwright test
```

## Project Structure

See [CLAUDE.md](CLAUDE.md) for full architecture documentation, module descriptions, and deployment instructions.

## API Documentation

- Local: `http://localhost:8000/docs`
- Staging: `https://api-staging.clinicapp.com/docs`
- Production: Disabled (use Postman collection in `docs/postman/`)

## License

Proprietary — All rights reserved.
