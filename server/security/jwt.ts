import jwt from "jsonwebtoken";
import type { AuthUser } from "../middleware/auth";

const SECRET = resolveSecret();
const ISSUER = process.env.JWT_ISSUER || "drrms.core";
const AUDIENCE = process.env.JWT_AUDIENCE || "drrms.clients";

function resolveSecret() {
  const secret = process.env.JWT_SECRET ?? "dev-mode-jwt-secret-change-immediately!!";
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters for HS512");
  }
  return secret;
}

export function signAuthToken(payload: AuthUser) {
  return jwt.sign(payload, SECRET, {
    algorithm: "HS512",
    expiresIn: "12h",
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, SECRET, {
    algorithms: ["HS512"],
    issuer: ISSUER,
    audience: AUDIENCE,
  }) as AuthUser;
}
