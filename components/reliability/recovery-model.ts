export type RecoveryPanelCopy = Readonly<{
  body: string;
  home: string;
  reference: string;
  retry: string;
  title: string;
}>;

export function createRecoveryPanelModel({
  copy,
  correlationId,
  direction,
  homeHref,
  locale,
  testId,
}: {
  copy: RecoveryPanelCopy;
  correlationId: string;
  direction: "ltr" | "rtl";
  homeHref: string;
  locale: "en" | "he";
  testId: string;
}) {
  return Object.freeze({
    bodyId: `${testId}-body`,
    copy,
    correlationId,
    direction,
    homeHref,
    locale,
    role: "alert" as const,
    titleId: `${testId}-title`,
  });
}
