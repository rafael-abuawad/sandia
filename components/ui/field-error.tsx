import { cn } from "@/lib/utils";

type FieldErrorProps = {
  id: string;
  message: string | null | undefined;
  className?: string;
};

/** Inline field/form error for aria-describedby wiring. */
export function FieldError({ id, message, className }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className={cn("text-sm text-danger", className)}>
      {message}
    </p>
  );
}
