// API constants
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
export const FACEBOOK_APP_ID: string = import.meta.env.VITE_FACEBOOK_APP_ID ?? "";
export const API_TIMEOUT = 30000;

// Role constants
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  TENANT_ADMIN: "tenant_admin",
  CLINIC_ADMIN: "clinic_admin",
  DOCTOR: "doctor",
  NURSE: "nurse",
  RECEPTIONIST: "receptionist",
  PATIENT: "patient",
} as const;

// Appointment status
export const APPOINTMENT_STATUS = {
  SCHEDULED: "scheduled",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  NO_SHOW: "no-show",
} as const;

// Pagination
export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// Date formats
export const DATE_FORMAT = "YYYY-MM-DD";
export const DATETIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
export const DISPLAY_DATE_FORMAT = "MMM DD, YYYY";

// Local storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: "clinic_auth_token",
  REFRESH_TOKEN: "clinic_refresh_token",
  USER: "clinic_user",
  TENANT_ID: "clinic_tenant_id",
} as const;

// Toast messages
export const MESSAGES = {
  SUCCESS_CREATE: "Created successfully",
  SUCCESS_UPDATE: "Updated successfully",
  SUCCESS_DELETE: "Deleted successfully",
  ERROR_CREATE: "Failed to create",
  ERROR_UPDATE: "Failed to update",
  ERROR_DELETE: "Failed to delete",
  ERROR_FETCH: "Failed to load data",
  ERROR_NETWORK: "Network error. Please try again.",
  ERROR_VALIDATION: "Please check your input",
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;
