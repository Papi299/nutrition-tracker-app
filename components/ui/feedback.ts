export function feedbackStyles(
  tone: "info" | "success" | "warning" | "danger" = "info",
  className = "",
) {
  return `ui-feedback ui-feedback-${tone} ${className}`.trim();
}
