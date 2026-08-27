import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  createClient,
  type AuthTokenResponsePassword,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey =
  process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localSupabaseServiceRoleKey =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
const localSupabaseMailpitUrl = process.env.LOCAL_SUPABASE_MAILPIT_URL;
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

export const localFixtureEligibilityVersion =
  "p11e-e001-private-beta-eligibility-v1";

function requireLocalFixtureConfiguration() {
  if (
    !localSupabaseUrl ||
    !localSupabasePublishableKey ||
    !localSupabaseServiceRoleKey ||
    !localSupabaseMailpitUrl ||
    !projectId
  ) {
    throw new Error("Local administrative test fixture is not configured.");
  }

  const hostname = new URL(localSupabaseUrl).hostname;
  const mailpitHostname = new URL(localSupabaseMailpitUrl).hostname;

  if (
    ![hostname, mailpitHostname].every((value) =>
      ["127.0.0.1", "localhost"].includes(value),
    )
  ) {
    throw new Error("Refusing to use a nonlocal administrative test fixture.");
  }

  return {
    databaseContainer: `supabase_db_${projectId}`,
    mailpitUrl: localSupabaseMailpitUrl,
    publishableKey: localSupabasePublishableKey,
    serviceRoleKey: localSupabaseServiceRoleKey,
    url: localSupabaseUrl,
  };
}

export async function provisionActivatedLocalUserForUi(credentials: {
  email: string;
  password: string;
}) {
  const fixture = requireLocalFixtureConfiguration();
  const client = createClient<Database>(fixture.url, fixture.publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  await provisionActivatedLocalUser(client, credentials);
  await client.auth.signOut();
}

function requireSyntheticEmail(email: string) {
  if (!email.endsWith("@example.test")) {
    throw new Error("Local auth fixtures require a synthetic example.test email.");
  }
}

function requireUuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("Local auth fixture received an invalid user identifier.");
  }
}

function adminClient() {
  const fixture = requireLocalFixtureConfiguration();

  return createClient<Database>(fixture.url, fixture.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function provisionInvitedIdentityWithPassword(credentials: {
  email: string;
  password: string;
}) {
  const administrator = adminClient();
  const appOrigin = new URL(
    process.env.PLAYWRIGHT_BASE_URL ??
      `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3100"}`,
  );

  if (!["127.0.0.1", "localhost"].includes(appOrigin.hostname)) {
    throw new Error("Refusing to provision an identity for a nonlocal app.");
  }

  const invited = await administrator.auth.admin.inviteUserByEmail(
    credentials.email,
    {
      redirectTo: new URL("/en/auth/confirm", appOrigin).toString(),
    },
  );
  const userId = invited.data.user?.id;

  if (invited.error || !userId) {
    throw new Error("Local invited-identity provisioning failed.");
  }

  const updated = await administrator.auth.admin.updateUserById(userId, {
    email_confirm: true,
    password: credentials.password,
  });

  if (updated.error) {
    throw new Error("Local invited-identity password provisioning failed.");
  }

  return userId;
}

export function queryLocalAuthFixture(statement: string) {
  const { databaseContainer } = requireLocalFixtureConfiguration();

  return execFileSync(
    "docker",
    [
      "exec",
      databaseContainer,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-c",
      statement,
    ],
    { encoding: "utf8" },
  ).trim();
}

function recordSyntheticActivation(userId: string) {
  requireUuid(userId);
  queryLocalAuthFixture(`
    insert into public.account_activations (
      user_id,
      activation_completed_at,
      eligibility_statement_version,
      eligibility_accepted_at
    ) values (
      '${userId}'::uuid,
      statement_timestamp(),
      '${localFixtureEligibilityVersion}',
      statement_timestamp()
    );
  `);
}

export async function provisionActivatedLocalUser(
  client: SupabaseClient<Database>,
  credentials: { email: string; password: string },
): Promise<AuthTokenResponsePassword> {
  requireSyntheticEmail(credentials.email);
  const userId = await provisionInvitedIdentityWithPassword(credentials);

  recordSyntheticActivation(userId);

  const signedIn = await client.auth.signInWithPassword(credentials);

  if (signedIn.error || !signedIn.data.user || !signedIn.data.session) {
    throw new Error("Local activated-user sign-in failed.");
  }

  return signedIn;
}

export async function provisionUnactivatedLocalUser(
  client: SupabaseClient<Database>,
  credentials: { email: string; password: string },
): Promise<AuthTokenResponsePassword> {
  requireSyntheticEmail(credentials.email);
  const userId = await provisionInvitedIdentityWithPassword(credentials);
  queryLocalAuthFixture(`
    update auth.users
    set invited_at = null
    where id = '${userId}'::uuid;
  `);

  const signedIn = await client.auth.signInWithPassword(credentials);

  if (signedIn.error || !signedIn.data.user || !signedIn.data.session) {
    throw new Error("Local incomplete-user sign-in failed.");
  }

  return signedIn;
}

export async function issueLocalInvitation({
  appOrigin,
  email,
  locale,
}: {
  appOrigin: string;
  email: string;
  locale: "en" | "he";
}) {
  requireSyntheticEmail(email);
  const origin = new URL(appOrigin);

  if (origin.hostname !== "127.0.0.1" && origin.hostname !== "localhost") {
    throw new Error("Refusing to issue an invitation for a nonlocal app.");
  }

  const administrator = adminClient();
  const result = await administrator.auth.admin.inviteUserByEmail(email, {
    redirectTo: new URL(`/${locale}/auth/confirm`, origin).toString(),
  });
  const userId = result.data.user?.id;

  if (result.error || !userId) {
    throw new Error("Local invitation provisioning failed.");
  }

  return { userId };
}

export function expireLocalInvitation(userId: string) {
  requireUuid(userId);
  queryLocalAuthFixture(`
    update auth.users
    set confirmation_sent_at = statement_timestamp() - interval '2 hours'
    where id = '${userId}'::uuid;
  `);
}

export async function waitForLocalInvitationLink(email: string) {
  requireSyntheticEmail(email);
  const { mailpitUrl } = requireLocalFixtureConfiguration();
  const searchUrl = new URL("/api/v1/search", mailpitUrl);
  searchUrl.searchParams.set("query", `to:${email}`);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const searchResponse = await fetch(searchUrl);

    if (searchResponse.ok) {
      const search = (await searchResponse.json()) as {
        messages?: Array<{ ID?: string }>;
      };
      const messageId = search.messages?.[0]?.ID;

      if (messageId) {
        const messageResponse = await fetch(
          new URL(`/api/v1/message/${encodeURIComponent(messageId)}`, mailpitUrl),
        );

        if (messageResponse.ok) {
          const message = (await messageResponse.json()) as {
            HTML?: string;
            Text?: string;
          };
          const contents = [message.HTML, message.Text]
            .filter(Boolean)
            .join("\n");
          const link = contents.match(/https?:\/\/[^\s"'<]+token_hash=[^\s"'<]+/i)?.[0]
            .replaceAll("&amp;", "&");

          if (link) {
            const parsedLink = new URL(link);

            if (
              parsedLink.hostname !== "127.0.0.1" &&
              parsedLink.hostname !== "localhost"
            ) {
              throw new Error("Local invitation email contained a nonlocal link.");
            }

            return link;
          }
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Local invitation email was not captured.");
}
