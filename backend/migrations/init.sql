-- ============================================================
-- ClinicManagement — Initial Database Setup
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- Fuzzy text search
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- Encryption functions
CREATE EXTENSION IF NOT EXISTS "btree_gin";   -- GIN indexes

-- ── Row Level Security setup ─────────────────────────────────────
-- All tenant-scoped tables will have RLS policies added after
-- Alembic migrations run. This file sets up the DB infrastructure.

-- Create app user with limited privileges
-- (Alembic/migration user has full access, app user is restricted)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'clinic_app') THEN
    CREATE ROLE clinic_app WITH LOGIN PASSWORD 'change_in_production';
  END IF;
END
$$;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO clinic_app;

-- ── Tenant context function ───────────────────────────────────────
-- Called at the start of each session to set tenant_id for RLS
CREATE OR REPLACE FUNCTION set_tenant_id(tenant_id TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_id, true);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_tenant_id', true);
EXCEPTION
  WHEN undefined_object THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ── Helper: updated_at trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Helper: MRN generation ────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS mrn_seq START 10000;

CREATE OR REPLACE FUNCTION generate_mrn(prefix TEXT DEFAULT 'MRN')
RETURNS TEXT AS $$
BEGIN
  RETURN prefix || '-' || LPAD(nextval('mrn_seq')::TEXT, 8, '0');
END;
$$ LANGUAGE plpgsql;

-- ── Helper: Invoice number generation ────────────────────────────
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 100000;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'INV-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(nextval('invoice_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ── Performance indexes (added after tables are created) ──────────
-- These will be added by Alembic but listed here for reference:
-- CREATE INDEX idx_appointments_date_doctor ON appointments(appointment_date, doctor_id) WHERE is_deleted = FALSE;
-- CREATE INDEX idx_appointments_patient ON appointments(patient_id, appointment_date DESC) WHERE is_deleted = FALSE;
-- CREATE INDEX idx_patients_phone ON patients(phone) WHERE is_deleted = FALSE;
-- CREATE INDEX idx_patients_mrn ON patients(mrn);
-- CREATE INDEX idx_patients_name_search ON patients USING gin(to_tsvector('english', first_name || ' ' || last_name));
-- CREATE INDEX idx_medical_records_patient ON medical_records(patient_id, visit_date DESC) WHERE is_deleted = FALSE;
-- CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id, prescribed_date DESC) WHERE is_deleted = FALSE;
-- CREATE INDEX idx_lab_reports_patient ON lab_reports(patient_id) WHERE is_deleted = FALSE;
-- CREATE INDEX idx_invoices_patient ON invoices(patient_id, issue_date DESC) WHERE is_deleted = FALSE;
-- CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, created_at DESC);
-- CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id, created_at DESC);
