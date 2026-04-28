import React from "react";

export default function DividerRow() {
  return (
    <tr>
      <td colSpan={2}>
        <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />
      </td>
    </tr>
  );
}
