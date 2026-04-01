// Global type definitions

export interface User {
  id: string;
  email: string;
  // camelCase (legacy / frontend-only)
  firstName?: string;
  lastName?: string;
  tenantId?: string;
  clinicId?: string;
  // snake_case (from backend API)
  first_name?: string;
  last_name?: string;
  full_name?: string;
  tenant_id?: string;
  clinic_id?: string;
  patient_id?: string;
  role: "super_admin" | "tenant_admin" | "clinic_admin" | "doctor" | "nurse" | "receptionist" | "patient";
  avatar?: string;
  lastLogin?: string;
  is_active?: boolean;
  status?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  clinicId: string;
  date: string;
  time: string;
  endTime: string;
  reason: string;
  status: "scheduled" | "completed" | "cancelled" | "no-show";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other";
  bloodType?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  insuranceProvider?: string;
  insuranceId?: string;
  emergencyContact: string;
  emergencyPhone: string;
  medicalHistory?: string;
  allergies?: string[];
  createdAt: string;
}

export interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specialization: string;
  licenseNumber: string;
  yearsOfExperience: number;
  qualifications: string[];
  clinics: string[];
  status: "active" | "inactive";
  rating?: number;
  createdAt: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  doctorId: string;
  medication: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate: string;
  refills: number;
  status: "active" | "completed" | "expired";
  notes?: string;
}

export interface LabOrder {
  id: string;
  patientId: string;
  doctorId: string;
  tests: string[];
  orderedDate: string;
  dueDate: string;
  status: "pending" | "collected" | "processing" | "completed";
  sampleCollected: boolean;
}

export interface LabReport {
  id: string;
  labOrderId: string;
  patientId: string;
  sampleDate: string;
  reportDate: string;
  labName: string;
  technician: string;
  results: LabResult[];
  notes?: string;
}

export interface LabResult {
  testName: string;
  result: string;
  unit: string;
  referenceRange: string;
  status: "normal" | "abnormal" | "critical";
}

export interface Invoice {
  id: string;
  patientId: string;
  invoiceDate: string;
  dueDate: string;
  status: "draft" | "sent" | "paid" | "overdue";
  subtotal: number;
  tax: number;
  total: number;
  lineItems: InvoiceLineItem[];
  notes?: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Clinic {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  zipCode: string;
  status: "open" | "closed" | "maintenance";
  workingHours?: string;
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  plan: "basic" | "professional" | "enterprise";
  clinics: number;
  users: number;
  status: "active" | "inactive" | "suspended";
  createdDate: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: { [key: string]: string };
}
