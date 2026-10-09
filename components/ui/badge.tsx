import type { ComponentPropsWithRef } from "react";

type BadgeVariant = "neutral" | "primary" | "success" | "warning" | "danger";

export function badgeStyles(variant: BadgeVariant = "neutral", className = "") {
  return `ui-badge ui-badge-${variant} ${className}`.trim();
}

export function Badge({
  variant,
  className,
  ...props
}: ComponentPropsWithRef<"span"> & { variant?: BadgeVariant }) {
  return <span {...props} className={badgeStyles(variant, className)} />;
}
