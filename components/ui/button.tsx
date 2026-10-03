import type { ComponentPropsWithRef } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

export function buttonStyles({
  variant = "primary",
  size = "md",
  className = "",
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return `ui-button ui-button-${variant} ui-button-${size} ${className}`.trim();
}

export function Button({
  variant,
  size,
  pending = false,
  disabled,
  type = "button",
  className,
  ...props
}: ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
}) {
  return (
    <button
      {...props}
      aria-busy={pending ? true : props["aria-busy"]}
      className={buttonStyles({ variant, size, className })}
      disabled={disabled || pending}
      type={type}
    />
  );
}
