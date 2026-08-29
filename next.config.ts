import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { browserSecurityHeaders } from "./lib/security/browser-headers";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: browserSecurityHeaders({
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
