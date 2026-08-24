import { AuthConfig } from "convex/server";

// Set on the Convex backend: npx convex env set PRIVY_APP_ID <app-id>
// Distinct from NEXT_PUBLIC_PRIVY_APP_ID, which the Next.js client reads.
const privyAppId = process.env.PRIVY_APP_ID ?? "";

// Privy access tokens use the bare string `privy.io` as the `iss` claim and
// publish JWKS at a non-standard path, so we use Convex's customJwt provider.
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
