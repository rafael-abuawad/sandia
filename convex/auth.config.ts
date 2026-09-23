import { AuthConfig } from "convex/server";

// Set on the Convex backend: npx convex env set PRIVY_APP_ID <app-id>
// Distinct from NEXT_PUBLIC_PRIVY_APP_ID, which the Next.js client reads.
const privyAppId = process.env.PRIVY_APP_ID ?? "";

const providers: AuthConfig["providers"] = [
  {
    type: "customJwt",
    issuer: "privy.io",
    jwks: `https://auth.privy.io/api/v1/apps/${privyAppId}/jwks.json`,
    algorithm: "ES256",
    applicationID: privyAppId,
  },
];

const sandiaIssuer = process.env.SANDIA_JWT_ISS;
const sandiaJwks = process.env.SANDIA_JWKS_URL;
const sandiaAud = process.env.SANDIA_JWT_AUD;
if (sandiaIssuer && sandiaJwks && sandiaAud) {
  providers.push({
    type: "customJwt",
    issuer: sandiaIssuer,
    jwks: sandiaJwks,
    algorithm: "RS256",
    applicationID: sandiaAud,
  });
}

const authConfig: AuthConfig = { providers };

export default authConfig;
