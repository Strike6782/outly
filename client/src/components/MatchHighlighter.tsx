"use client";

import React, { memo } from "react";

interface MatchHighlighterProps {
  text: string;
  query: string;
  className?: string;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitize(str: string): string {
  return str.replace(/<[^>]*>/g, "");
}

function MatchHighlighterInner({ text, query, className }: MatchHighlighterProps) {
  if (!query || !query.trim()) {
    return <span className={className}>{text}</span>;
  }

  const sanitized = sanitize(query.trim());
  if (!sanitized) return <span className={className}>{text}</span>;

  const escaped = escapeRegex(sanitized);
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-yellow-100 text-yellow-900 rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </span>
  );
}

const MatchHighlighter = memo(MatchHighlighterInner);
export default MatchHighlighter;
