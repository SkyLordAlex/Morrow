import { createRemoteJWKSet, jwtVerify } from "jose";

// Verify the identity/ID tokens that Apple and Google hand back to the client
// after a native sign-in. The client never sends us a password — it sends the
// signed JWT, and we check the signature against the provider's published keys,
// plus the issuer and audience. `subject` is the provider's stable per-user id;
// `email` is the verified address we link accounts on.

export interface VerifiedIdentity {
  subject: string;
  email: string;
}

/** Thrown when the server is missing the client-id configuration for a provider. */
export class AuthConfigError extends Error {
  readonly name = "AuthConfigError";
}

function audiences(envVar: string): string[] {
  const raw = process.env[envVar];
  const list = (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (list.length === 0) {
    throw new AuthConfigError(
      `${envVar} is not set. Add the client ID(s) for this provider to the API server environment.`,
    );
  }
  return list;
}

// createRemoteJWKSet caches keys in-process and refreshes on rotation, so build
// each set once at module load.
const appleJwks = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);
const googleJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

function emailFrom(payload: Record<string, unknown>): string {
  const email = payload["email"];
  if (typeof email !== "string" || !email.includes("@")) {
    throw new Error("Identity token has no email claim");
  }
  return email.toLowerCase();
}

export async function verifyAppleIdentityToken(
  identityToken: string,
): Promise<VerifiedIdentity> {
  const { payload } = await jwtVerify(identityToken, appleJwks, {
    issuer: "https://appleid.apple.com",
    audience: audiences("APPLE_CLIENT_IDS"),
  });
  if (!payload.sub) throw new Error("Apple token has no subject");
  return { subject: payload.sub, email: emailFrom(payload) };
}

export async function verifyGoogleIdToken(
  idToken: string,
): Promise<VerifiedIdentity> {
  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: audiences("GOOGLE_CLIENT_IDS"),
  });
  if (!payload.sub) throw new Error("Google token has no subject");
  return { subject: payload.sub, email: emailFrom(payload) };
}
