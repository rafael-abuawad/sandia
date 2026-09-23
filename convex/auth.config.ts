import { AuthConfig } from "convex/server";

const providers: AuthConfig["providers"] = [];

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
