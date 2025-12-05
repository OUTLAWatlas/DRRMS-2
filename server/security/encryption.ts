import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "enc.v1";
const ALGORITHM = "aes-256-gcm";
let cachedKey: Buffer | null = null;

function resolveKey() {
  if (cachedKey) return cachedKey;
  const secret = process.env.DATA_ENCRYPTION_KEY;
  const fallback = process.env.JWT_SECRET;
  const source = secret ?? fallback;
  if (!source) {
    throw new Error("DATA_ENCRYPTION_KEY or JWT_SECRET must be configured to derive an encryption key");
  }
  const candidates = [
    Buffer.from(source, "base64"),
    Buffer.from(source, "hex"),
    Buffer.from(source, "utf8"),
  ];
  const key = candidates.find((candidate) => candidate.length === 32);
  if (!key) {
    throw new Error("DATA_ENCRYPTION_KEY must decode to 32 bytes for AES-256-GCM");
  }
  cachedKey = key;
  return key;
}

export function encryptField(value: string | null | undefined) {
  if (!value) return value ?? null;
  const key = resolveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString("base64")}:${ciphertext.toString("base64")}:${authTag.toString("base64")}`;
}

export function decryptField(value: string | null | undefined) {
  if (!value) return value ?? null;
  if (!value.startsWith?.(`${PREFIX}:`)) {
    return value;
  }
  const key = resolveKey();
  const [, ivB64, dataB64, tagB64] = value.split(":");
  if (!ivB64 || !dataB64 || !tagB64) {
    return value;
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    return value;
  }
}

export function redact(value: string | null | undefined) {
  if (!value) return value ?? null;
  return value.startsWith(`${PREFIX}:`) ? "[encrypted]" : value;
}
