"use client";

import { useState } from "react";
import Input from "@/components/Input";
import Button from "@/components/Button";
import { Editor } from "./Editor";
import { Plus, Trash2, GripVertical, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SequenceStepInput } from "@/types";

interface SequenceBuilderProps {
  steps: SequenceStepInput[];
  onChange: (steps: SequenceStepInput[]) => void;
}

const MAX_FOLLOW_UPS = 5;

export default function SequenceBuilder({ steps, onChange }: SequenceBuilderProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const addStep = () => {
    if (steps.length >= MAX_FOLLOW_UPS) return;
    onChange([...steps, { subject: "", body: "", waitDays: 3 }]);
    setExpandedStep(steps.length);
  };

  const removeStep = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
    setExpandedStep(null);
  };

  const updateStep = (index: number, field: keyof SequenceStepInput, value: string | number) => {
    const updated = steps.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    );
    onChange(updated);
  };

  const toggleExpand = (index: number) => {
    setExpandedStep(expandedStep === index ? null : index);
  };

  return (
    <div className="mt-3 md:mt-4 rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 md:px-5 py-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Follow-up Sequence
          </p>
          <p className="text-[10px] text-gray-300 mt-0.5">
            {steps.length === 0
              ? "No follow-ups configured"
              : `${steps.length} follow-up${steps.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button
          variant="outline"
          className={cn(
            "w-auto px-3 py-1.5 rounded-lg text-[11px] gap-1",
            steps.length >= MAX_FOLLOW_UPS && "opacity-50 cursor-not-allowed"
          )}
          onClick={addStep}
          disabled={steps.length >= MAX_FOLLOW_UPS}
          title={steps.length >= MAX_FOLLOW_UPS ? "Maximum 5 follow-ups" : "Add follow-up step"}
        >
          <Plus className="h-3 w-3" />
          Add Follow-up
        </Button>
      </div>

      {/* Step 0 indicator */}
      {steps.length > 0 && (
        <div className="mx-4 md:mx-5 mb-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
          <p className="text-[11px] font-medium text-gray-500">
            Step 1 — Initial Email
          </p>
          <p className="text-[10px] text-gray-400">Uses the main subject and body above</p>
        </div>
      )}

      {/* Follow-up steps */}
      <div className="px-4 md:px-5 pb-4 space-y-2">
        {steps.map((step, index) => (
          <div
            key={index}
            className="rounded-xl border border-gray-100 overflow-hidden transition-all duration-200
              opacity-0 animate-[fadeIn_0.2s_ease-out_forwards]"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Step header — clickable to expand */}
            <div
              className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50/50 transition-colors"
              onClick={() => toggleExpand(index)}
            >
              <GripVertical className="h-3.5 w-3.5 text-gray-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-gray-600">
                  Step {index + 2} — Follow-up
                </p>
                <p className="text-[10px] text-gray-400 truncate">
                  {step.subject || "No subject"} · Wait {step.waitDays} day{step.waitDays !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeStep(index); }}
                className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-gray-300 transition-transform duration-200",
                  expandedStep === index && "rotate-180"
                )}
              />
            </div>

            {/* Expanded content */}
            <div
              className={cn(
                "overflow-hidden transition-all duration-200 ease-out",
                expandedStep === index ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
              )}
            >
              <div className="px-3 pb-3 space-y-3 border-t border-gray-50 pt-3">
                {/* Wait days */}
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-medium text-gray-500 shrink-0">
                    Wait
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={step.waitDays}
                    onChange={(e) => updateStep(index, "waitDays", parseInt(e.target.value) || 1)}
                    className="h-8 w-16 rounded-md border border-gray-200 bg-white text-center text-xs font-semibold text-gray-900 outline-none focus:border-gray-300"
                  />
                  <span className="text-[11px] text-gray-400">days after previous step</span>
                </div>

                {/* Subject */}
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-500">Subject</label>
                  <Input
                    value={step.subject}
                    onChange={(e) => updateStep(index, "subject", e.target.value)}
                    placeholder="Follow-up: {{company}} opportunity"
                    className="text-xs"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-500">Body</label>
                  <div className="rounded-md border border-gray-200 overflow-hidden">
                    <Editor
                      value={step.body}
                      onChange={(html) => updateStep(index, "body", html)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
