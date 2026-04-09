"use client";

/** Small inline loading indicator for buttons and labels. */
export default function InlineSpinner({ className }: { className?: string }) {
  return <span className={`inline-spinner${className ? ` ${className}` : ""}`} role="status" aria-label="Loading" />;
}
