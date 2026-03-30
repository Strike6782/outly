"use client";

import { useEffect, useState } from "react";
import Dropdown, { DropdownOption } from "@/components/Dropdown";
import { getTemplates } from "@/lib/apis";
import type { EmailTemplate } from "@/types";

interface TemplateSelectorProps {
  onSelect: (template: EmailTemplate) => void;
}

export default function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await getTemplates();
        setTemplates(data);
      } catch {
        // Silently fail — template selector is optional
      }
    })();
  }, []);

  const options: DropdownOption[] = templates.map((t) => ({
    label: t.name,
    value: t.id,
  }));

  const handleChange = (value: string) => {
    setSelected(value);
    const template = templates.find((t) => t.id === value);
    if (template) onSelect(template);
  };

  return (
    <Dropdown
      options={options}
      value={selected}
      onChange={handleChange}
      placeholder="Add template"
      className="w-full"
    />
  );
}
