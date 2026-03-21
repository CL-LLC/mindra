import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      // Must match the issuer/audience used by @convex-dev/auth when it signs tokens.
      domain: process.env.CONVEX_SITE_URL ?? "http://localhost:3000",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;

