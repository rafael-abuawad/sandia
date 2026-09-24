import { AuthConfig } from "convex/server";

// Set on the Convex backend: npx convex env set PRIVY_APP_ID <app-id>
// Distinct from NEXT_PUBLIC_PRIVY_APP_ID, which the Next.js client reads.
const privyAppId = process.env.PRIVY_APP_ID ?? "";

const authConfig: AuthConfig = {
  providers: [
    {
      type: "customJwt",
      issuer: "privy.io",
      jwks: `https://auth.privy.io/api/v1/apps/${privyAppId}/jwks.json`,
      algorithm: "ES256",
      applicationID: privyAppId,
    },
  ],
};

export default authConfig;
