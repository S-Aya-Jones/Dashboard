"use client";

export function PrintButton() {
  return (
    <button className="btn alt" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}
