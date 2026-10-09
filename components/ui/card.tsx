import type { ComponentPropsWithRef } from "react";

type SurfaceVariant = "default" | "subtle" | "raised";

export function surfaceStyles({
  variant = "default",
  className = "",
}: { variant?: SurfaceVariant; className?: string } = {}) {
  return `ui-card ui-card-${variant} ${className}`.trim();
}

export function Card({
  variant,
  className,
  ...props
}: ComponentPropsWithRef<"div"> & { variant?: SurfaceVariant }) {
  return <div {...props} className={surfaceStyles({ variant, className })} />;
}
