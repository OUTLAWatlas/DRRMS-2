import { authenticator } from "otplib";
import { randomBytes, createHash, timingSafeEqual } from "crypto";
import { decryptField, encryptField } from "./encryption";

authenticator.options = { step: 30, window: 1 };

const ISSUER = process.env.JWT_ISSUER || "DRRMS";

export function issueMfaSetup(email: string) {
  const secret = authenticator.generateSecret(32);
  const uri = authenticator.keyuri(email, ISSUER, secret);
  return { secret, uri }; 
}

export function encryptMfaSecret(secret: string) {
  return encryptField(secret);
}

export function decryptMfaSecret(secret: string | null) {
  if (!secret) return null;
  return decryptField(secret);
}

export function verifyMfaToken({ secret, token }: { secret: string; token: string }) {
  if (!token) return false;
  return authenticator.check(token, secret);
}

export function generateRecoveryCodes(count = 5) {
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    codes.push(randomBytes(5).toString("hex"));
  }
  return codes;
}

export function hashRecoveryCodes(codes: string[]) {
  return JSON.stringify(codes.map(hashRecoveryCode));
}

export function parseRecoveryCodes(payload?: string | null) {
  if (!payload) return [];
  try {
    const parsed = JSON.parse(payload) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

export function consumeRecoveryCode(options: { storedPayload?: string | null; provided?: string }) {
  const stored = parseRecoveryCodes(options.storedPayload);
  if (!stored.length || !options.provided) return { ok: false };
  const providedHash = hashRecoveryCode(options.provided);
  const idx = stored.findIndex((entry) => safeCompare(entry, providedHash));
  if (idx === -1) return { ok: false };
  stored.splice(idx, 1);
  return { ok: true, remaining: JSON.stringify(stored) };
}

function hashRecoveryCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function safeCompare(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
