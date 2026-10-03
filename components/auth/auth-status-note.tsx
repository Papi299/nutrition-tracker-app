import { feedbackStyles } from "@/components/ui/feedback";

export function AuthStatusNote({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "error" | "info" | "success";
}) {
  return (
    <div
      className={feedbackStyles(tone === "error" ? "danger" : tone)}
      role={tone === "error" ? "alert" : "status"}
      tabIndex={tone === "error" ? -1 : undefined}
    >
      {children}
    </div>
  );
}
