export function AuthStatusNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-s-4 border-teal-600 bg-teal-50 px-4 py-3 text-start text-sm leading-6 text-slate-700">
      {children}
    </div>
  );
}
