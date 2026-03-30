"use client";

import { useMemo, useState } from "react";
import { ChevronDown, CheckCircle2, AlertTriangle, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { matchVariablesToColumns } from "@/lib/csvParser";

const VARIABLE_PATTERN = /\{\{([a-zA-Z0-9_]+)\}\}/g;

interface VariablePreviewProps {
  subject: string;
  body: string;
  recipientColumnData: Record<string, Record<string, string>>;
  recipients: string[];
}

export default function VariablePreview({
  subject,
  body,
  recipientColumnData,
  recipients,
}: VariablePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Extract all unique variable names from subject + body
  const variables = useMemo(() => {
    const combined = `${subject} ${body}`;
    const vars = new Set<string>();
    let match;
    const re = new RegExp(VARIABLE_PATTERN.source, "g");
    while ((match = re.exec(combined)) !== null) {
      vars.add(match[1]);
    }
    return Array.from(vars);
  }, [subject, body]);

  // Get first recipient's column data for preview
  const firstRecipient = recipients[0];
  const firstColumnData = firstRecipient
    ? recipientColumnData[firstRecipient.toLowerCase()] ?? {}
    : {};

  const columnHeaders = Object.keys(firstColumnData);
  const { matched, unmatched } = useMemo(
    () => matchVariablesToColumns(variables, columnHeaders),
    [variables, columnHeaders]
  );

  // Resolve preview content
  const resolveContent = (content: string): string => {
    if (!firstRecipient || !Object.keys(firstColumnData).length) return content;
    const lowerMap: Record<string, string> = {};
    for (const key of Object.keys(firstColumnData)) {
      lowerMap[key.toLowerCase()] = firstColumnData[key];
    }
    return content.replace(VARIABLE_PATTERN, (match, varName: string) => {
      const val = lowerMap[varName.toLowerCase()];
      return val !== undefined ? val : match;
    });
  };

  const resolvedSubject = resolveContent(subject);
  const resolvedBody = resolveContent(body);
  const hasRecipients = recipients.length > 0 && Object.keys(firstColumnData).length > 0;

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 md:px-5 py-3 hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            Email Preview
          </span>
          {hasRecipients && (
            <span className="text-[10px] text-gray-300">
              — showing for {firstRecipient}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-gray-300 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Collapsible content */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-out",
          isOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-4 md:px-5 pb-4 space-y-3">
          {/* Variable status badges - only if variables exist */}
          {variables.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {matched.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600"
                >
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  {`{{${v}}}`}
                </span>
              ))}
              {unmatched.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600"
                >
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          )}

          {!hasRecipients && variables.length > 0 && (
            <p className="text-[10px] text-gray-400 italic">
              Import a CSV to see variable values.
            </p>
          )}

          {/* Resolved subject preview */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 mb-1">Subject</p>
            <p className="text-xs text-gray-700 bg-gray-50/80 rounded-lg px-3 py-2 border border-gray-100">
              {resolvedSubject || <span className="text-gray-300 italic">No subject...</span>}
            </p>
          </div>

          {/* Resolved body preview */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 mb-1">Body Preview</p>
            <div
              className="text-xs text-gray-700 bg-gray-50/80 rounded-lg px-3 py-2 border border-gray-100 max-h-48 overflow-y-auto prose prose-sm prose-gray"
              dangerouslySetInnerHTML={{ __html: resolvedBody || "<span class='text-gray-300 italic'>No content yet...</span>" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
