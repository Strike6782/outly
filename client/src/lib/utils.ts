import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

/** Short relative time for mobile (e.g., "2h ago", "3d ago") */
export function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "now";
}

/** Strip HTML tags and decode entities for plain-text previews */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resolves template variables like {{Name}} using columnData. Case-insensitive. */
export function resolveVariables(
  content: string,
  columnData: Record<string, string> = {},
  options?: { email?: string }
): string {
  if (!content) return "";
  
  // Create lowercase map for case-insensitive lookup
  const lowerMap: Record<string, string> = {};
  Object.keys(columnData).forEach(key => {
    lowerMap[key.toLowerCase()] = columnData[key];
  });

  // Always add email if provided
  if (options?.email) {
    lowerMap["email"] = options.email;
  }

  return content.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, varName) => {
    const value = lowerMap[varName.toLowerCase()];
    return value !== undefined ? value : match;
  });
}
