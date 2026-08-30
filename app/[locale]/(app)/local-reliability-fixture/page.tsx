import { notFound, redirect } from "next/navigation";
import { resolveAuthLocale } from "@/lib/auth/require-user";
import {
  consumeLocalRenderFailure,
  isLocalReliabilityTestFixtureEnabled,
} from "@/lib/reliability/local-test-fixture";

export const dynamic = "force-dynamic";

export default async function LocalReliabilityFixture({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeInput } = await params;
  const locale = resolveAuthLocale(localeInput);

  if (!isLocalReliabilityTestFixtureEnabled()) {
    notFound();
  }

  if (await consumeLocalRenderFailure()) {
    throw new Error("Synthetic local render failure for Phase 11G1.");
  }

  redirect(`/${locale}/today`);
}
