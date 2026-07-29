"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Form submit button that swaps to a spinner + pending label while the server action runs. */
export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: ReactNode;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-70`}>
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-[2px] border-current border-t-transparent" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
