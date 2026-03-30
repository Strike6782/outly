interface ValidationResult {
  valid: boolean;
  error?: { status: number; message: string };
}

const MAX_QUERY_LENGTH = 200;

export function validateSearchQuery(q?: string): ValidationResult {
  if (q && q.length > MAX_QUERY_LENGTH) {
    return { valid: false, error: { status: 400, message: "Search query must not exceed 200 characters" } };
  }
  return { valid: true };
}

export function validateStatusParam(status?: string, allowedValues?: string[]): ValidationResult {
  if (!status) return { valid: true };
  if (allowedValues && !allowedValues.includes(status)) {
    return { valid: false, error: { status: 400, message: `Invalid status. Allowed values: ${allowedValues.join(", ")}` } };
  }
  return { valid: true };
}

export function validateDateRange(dateFrom?: string, dateTo?: string): ValidationResult {
  if (dateFrom && isNaN(new Date(dateFrom).getTime())) {
    return { valid: false, error: { status: 400, message: "Invalid date format for dateFrom. Use ISO 8601 (e.g., 2024-01-15)" } };
  }
  if (dateTo && isNaN(new Date(dateTo).getTime())) {
    return { valid: false, error: { status: 400, message: "Invalid date format for dateTo. Use ISO 8601 (e.g., 2024-01-15)" } };
  }
  if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
    return { valid: false, error: { status: 400, message: "dateFrom must not be after dateTo" } };
  }
  return { valid: true };
}

const ALLOWED_DATE_FIELDS = ["createdAt", "scheduledAt", "sentAt"];

export function validateDateField(dateField?: string): ValidationResult {
  if (!dateField) return { valid: true };
  if (!ALLOWED_DATE_FIELDS.includes(dateField)) {
    return { valid: false, error: { status: 400, message: `Invalid dateField. Allowed values: ${ALLOWED_DATE_FIELDS.join(", ")}` } };
  }
  return { valid: true };
}
