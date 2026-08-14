import { SetupPage, type SetupPageProps } from "@/components/setup/setup-page";
import { routing } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default function ProgressiveSetupPage(props: SetupPageProps) {
  return <SetupPage {...props} progressive />;
}
