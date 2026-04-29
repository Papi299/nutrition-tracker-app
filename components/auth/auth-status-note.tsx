export function AuthStatusNote({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "error" | "info" | "success";
}) {
  const toneClassName = {
    error: "border-red-600 bg-red-50 text-red-900",
    info: "border-teal-600 bg-teal-50 text-slate-700",
    success: "border-teal-600 bg-teal-50 text-teal-900",
  }[tone];

  return (
    <div
      className={`border-s-4 px-4 py-3 text-start text-sm leading-6 ${toneClassName}`}
    >
      {children}
    </div>
  );
}
