"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button that disables and shows a spinner while its form's server
 * action runs — rule parsing goes through the AI, so it takes a few seconds.
 * The spinner inherits the button's text color, so it works on filled and
 * outline variants alike.
 */
export function PendingButton({
  children,
  pendingText,
  disabled,
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`inline-flex items-center justify-center gap-1.5 ${className ?? ""}`}
    >
      {pending && (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      )}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
