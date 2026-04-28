import React, { useEffect, useRef } from "react";

export default function EditableCell({ value, placeholder, align = "right", onChange }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const next = String(value ?? "");
    if (ref.current.innerText !== next) ref.current.innerText = next;
  }, [value]);

  const emit = () => {
    const txt = String(ref.current?.innerText ?? "")
      .replace(/\u00A0/g, " ")
      .replace(/\n/g, " ")
      .trim();
    onChange?.(txt);
  };

  return (
    <span
      ref={ref}
      className="editable-value editable-placeholder"
      data-placeholder={placeholder || ""}
      contentEditable
      suppressContentEditableWarning
      style={{ textAlign: align, display: "inline-block" }}
      onInput={emit}
      onBlur={emit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
    />
  );
}
