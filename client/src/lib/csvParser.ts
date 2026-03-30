const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedRecipient {
  email: string;
  columnData: Record<string, string>;
}

/**
 * Parses a CSV string with a header row. First column is email,
 * remaining columns become columnData keyed by header names.
 */
export function parseCsv(csv: string): ParsedRecipient[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const recipients: ParsedRecipient[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const email = cols[0];
    if (!email || !EMAIL_REGEX.test(email)) continue;

    const columnData: Record<string, string> = {};
    for (let j = 1; j < headers.length; j++) {
      if (headers[j] && cols[j] !== undefined) {
        columnData[headers[j]] = cols[j];
      }
    }
    recipients.push({ email, columnData });
  }

  return recipients;
}

/**
 * Partitions template variable names into matched and unmatched sets
 * based on CSV column headers. Case-insensitive comparison.
 */
export function matchVariablesToColumns(
  variableNames: string[],
  columnHeaders: string[]
): { matched: string[]; unmatched: string[] } {
  const lowerHeaders = new Set(columnHeaders.map((h) => h.toLowerCase()));
  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const v of variableNames) {
    if (lowerHeaders.has(v.toLowerCase())) {
      matched.push(v);
    } else {
      unmatched.push(v);
    }
  }

  return { matched, unmatched };
}
