import type { ComponentPropsWithRef } from "react";

export function Input({ className = "", ...props }: ComponentPropsWithRef<"input">) {
  return <input {...props} className={`ui-control ${className}`.trim()} />;
}

export function Select({ className = "", ...props }: ComponentPropsWithRef<"select">) {
  return <select {...props} className={`ui-control ${className}`.trim()} />;
}

export function Textarea({ className = "", ...props }: ComponentPropsWithRef<"textarea">) {
  return <textarea {...props} className={`ui-control ${className}`.trim()} />;
}

export function FieldLabel({ className = "", ...props }: ComponentPropsWithRef<"label">) {
  return <label {...props} className={`ui-label ${className}`.trim()} />;
}

export function FieldDescription({ className = "", ...props }: ComponentPropsWithRef<"span">) {
  return <span {...props} className={`ui-body-secondary ${className}`.trim()} />;
}

export function FieldError({ className = "", ...props }: ComponentPropsWithRef<"span">) {
  return <span {...props} className={`ui-field-error ${className}`.trim()} />;
}
