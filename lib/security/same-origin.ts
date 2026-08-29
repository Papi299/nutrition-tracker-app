import "server-only";

function applicationOrigin() {
  const rawOrigin = process.env.APP_ORIGIN;

  if (!rawOrigin) {
    throw new Error("The server-owned application origin is not configured.");
  }

  const origin = new URL(rawOrigin);

  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("The server-owned application origin is invalid.");
  }

  return origin;
}

export function requestIsSameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return false;
  }

  const suppliedOrigin = request.headers.get("origin");

  if (!suppliedOrigin) {
    return true;
  }

  try {
    return new URL(suppliedOrigin).origin === applicationOrigin().origin;
  } catch {
    return false;
  }
}

export function applicationUrl(path: string) {
  return new URL(path, applicationOrigin());
}
