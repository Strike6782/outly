import { resolveVariables } from "./templateParser";

export interface RecipientData {
  email: string;
  columnData: Record<string, string>;
}

export interface ResolvedContent {
  subject: string;
  body: string;
}

/**
 * Resolves template variables for a single recipient.
 * Delegates to templateParser.resolveVariables for both subject and body.
 * Case-insensitive key matching on columnData keys.
 */
export function resolveForRecipient(
  subject: string,
  body: string,
  recipientData: RecipientData
): ResolvedContent {
  return {
    subject: resolveVariables(subject, recipientData.columnData),
    body: resolveVariables(body, recipientData.columnData),
  };
}
