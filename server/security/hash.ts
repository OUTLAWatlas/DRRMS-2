import { createHash } from "crypto";

export function hashSensitiveValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
