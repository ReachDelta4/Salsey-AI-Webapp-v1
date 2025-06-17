import React from "react";
import { Textarea } from "@/components/ui/textarea";

interface TabContentProps {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  disabled: boolean;
  minHeight?: string;
  className?: string;
}

export const TabContent = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
  minHeight = "200px",
  className = ""
}: TabContentProps) => {
  return (
    <div className="mt-4 space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`min-h-[${minHeight}] ${className}`}
        disabled={disabled}
      />
    </div>
  );
}; 