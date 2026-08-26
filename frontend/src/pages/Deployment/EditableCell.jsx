import React from "react";

export default function EditableCell({
  value,
  placeholder,
  align = "right",
  onChange,
}) {
  return (
    <input
      type="text"
      className="input editable-value"
      value={value ?? ""}
      placeholder={placeholder || ""}
      onChange={(e) => onChange?.(e.target.value)}
      style={{
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        textAlign: align,
      }}
    />
  );
}