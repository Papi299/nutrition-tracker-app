import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { browserSecurityHeaders } from "./lib/security/browser-headers";
import { assertDeploymentEnvironment } from "./lib/deployment/environment.mjs";

assertDeploymentEnvironment(process.env);

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: browserSecurityHeaders({
          appEnvironment: process.env.APP_ENVIRONMENT,
          appOrigin: process.env.APP_ORIGIN,
          environment: process.env.NODE_ENV,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        }),
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
