const VARIABLE_PATTERN = /\{\{([a-zA-Z0-9_]+)\}\}/g;

/**
 * Extracts all unique variable names from a template string.
 * Returns an empty array if no variables are found.
 */
export function parseVariables(content: string): string[] {
  const matches = content.matchAll(VARIABLE_PATTERN);
  const variables = new Set<string>();
  for (const match of matches) {
    variables.add(match[1]);
  }
  return Array.from(variables);
}

/**
 * Substitutes {{variable_name}} tokens in content with values from the provided map.
 * Uses case-insensitive key matching. Unmatched variables are left as-is.
 */
export function resolveVariables(
  content: string,
  variables: Record<string, string>
): string {
  const lowerKeyMap: Record<string, string> = {};
  for (const key of Object.keys(variables)) {
    lowerKeyMap[key.toLowerCase()] = variables[key];
  }

  return content.replace(VARIABLE_PATTERN, (match, varName: string) => {
    const value = lowerKeyMap[varName.toLowerCase()];
    return value !== undefined ? value : match;
  });
}

/**
 * Serializes template content back to its stored format.
 * Identity operation — preserves all {{variable}} tokens and HTML structure.
 * Exists to formalize the round-trip property: print(parse(template)) === template.
 */
export function printTemplate(content: string): string {
  return content;
}
