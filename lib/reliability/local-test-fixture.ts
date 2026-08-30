type ReliabilityTestEnvironment = Readonly<Record<string, string | undefined>>;

function isLoopbackHttpUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost")
    );
  } catch {
    return false;
  }
}

export function isLocalReliabilityTestFixtureEnabled(
  environment: ReliabilityTestEnvironment = process.env,
) {
  return (
    environment.DATE_E2E_LOCAL_SUPABASE === "1" &&
    isLoopbackHttpUrl(environment.APP_ORIGIN) &&
    isLoopbackHttpUrl(environment.LOCAL_SUPABASE_URL) &&
    isLoopbackHttpUrl(environment.NEXT_PUBLIC_SUPABASE_URL) &&
    isLoopbackHttpUrl(environment.LOCAL_RELIABILITY_FAULT_CONTROL_URL)
  );
}

export async function consumeLocalRenderFailure(
  environment: ReliabilityTestEnvironment = process.env,
) {
  if (!isLocalReliabilityTestFixtureEnabled(environment)) {
    return false;
  }

  try {
    const response = await fetch(
      new URL(
        "/__phase11g1/render-failure/consume",
        environment.LOCAL_RELIABILITY_FAULT_CONTROL_URL,
      ),
      { cache: "no-store", method: "POST" },
    );
    return response.status === 204;
  } catch {
    return false;
  }
}
