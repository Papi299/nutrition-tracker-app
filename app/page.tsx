export default function Home() {
  const pillars = [
    "Food logging",
    "Manual targets",
    "Hebrew/English support",
    "Custom foods",
    "Data transparency",
  ];

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-12 px-6 py-16 sm:px-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
            Foundation build
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-6xl">
            A quiet starting point for a bilingual nutrition tracker.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
            This app is only the product foundation: Next.js, TypeScript,
            Tailwind CSS, and a clean App Router surface ready for careful,
            reviewable feature work.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {pillars.map((pillar) => (
            <div
              className="border border-slate-200 bg-white p-4 shadow-sm"
              key={pillar}
            >
              <p className="text-sm font-medium text-slate-900">{pillar}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-l-4 border-teal-600 pl-5 text-sm leading-6 text-slate-700 sm:max-w-2xl">
          <p>
            Planned direction includes English and Hebrew support with proper
            RTL behavior, including עברית interfaces and search later.
          </p>
          <p>
            No food search, diary, targets, auth, barcode scanning, database,
            Supabase, or deployment wiring is implemented in this bootstrap.
          </p>
        </div>
      </section>
    </main>
  );
}
