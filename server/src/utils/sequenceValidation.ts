export interface SequenceStepInput {
  subject: string;
  body: string;
  waitDays: number;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

const MAX_FOLLOW_UP_STEPS = 5;

/**
 * Validates an array of follow-up sequence steps.
 * Returns { valid: true } if all steps pass, or { valid: false, message } on first failure.
 * Rejects the entire batch if any step is invalid.
 */
export function validateSequenceSteps(steps: SequenceStepInput[]): ValidationResult {
  if (!Array.isArray(steps)) {
    return { valid: false, message: "Steps must be an array" };
  }

  if (steps.length > MAX_FOLLOW_UP_STEPS) {
    return { valid: false, message: "Maximum of 5 follow-up steps allowed" };
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const label = `Step ${i + 1}`;

    if (!step.subject || typeof step.subject !== "string" || step.subject.trim() === "") {
      return { valid: false, message: `${label}: Subject is required` };
    }

    if (!step.body || typeof step.body !== "string" || step.body.trim() === "") {
      return { valid: false, message: `${label}: Body is required` };
    }

    if (typeof step.waitDays !== "number" || !Number.isInteger(step.waitDays) || step.waitDays < 1) {
      return { valid: false, message: `${label}: Wait period must be a whole number of days (minimum 1)` };
    }
  }

  return { valid: true };
}
