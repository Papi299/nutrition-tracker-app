import { expect, test } from "@playwright/test";
import { createRecoveryPanelModel } from "@/components/reliability/recovery-model";
import { recoveryPolicy } from "@/lib/reliability/recovery-policy";
import en from "@/messages/en.json";
import he from "@/messages/he.json";

const correlationId = "obs_0123456789abcdef0123456789abcdef";

test.describe("localized failure recovery UI", () => {
  for (const recoveryCase of [
    {
      copy: en.Reliability.boundary,
      direction: "ltr" as const,
      locale: "en" as const,
    },
    {
      copy: he.Reliability.boundary,
      direction: "rtl" as const,
      locale: "he" as const,
    },
  ]) {
    test(`renders the ${recoveryCase.locale} recovery action with correct direction and safe content`, () => {
      const model = createRecoveryPanelModel({
        copy: recoveryCase.copy,
        correlationId,
        direction: recoveryCase.direction,
        homeHref: `/${recoveryCase.locale}`,
        locale: recoveryCase.locale,
        testId: "reliability-recovery",
      });

      expect(model.locale).toBe(recoveryCase.locale);
      expect(model.direction).toBe(recoveryCase.direction);
      expect(model.role).toBe("alert");
      expect(model.titleId).toBe("reliability-recovery-title");
      expect(model.bodyId).toBe("reliability-recovery-body");
      expect(model.homeHref).toBe(`/${recoveryCase.locale}`);
      expect(model.correlationId).toBe(correlationId);
      expect(JSON.stringify(model)).not.toMatch(
        /stack|select\s|supabase|authorization|bearer|password|service[_-]?role|user[_-]?id|nutrition|calories/i,
      );
    });
  }

  test("never authorizes automatic mutation replay for recovery conditions", () => {
    expect(
      Object.values(recoveryPolicy).every(
        ({ automaticMutationReplay }) => automaticMutationReplay === false,
      ),
    ).toBe(true);
    expect(recoveryPolicy.mutationStatusUncertain.recovery).toBe(
      "reload_and_review_current_state",
    );
  });
});
