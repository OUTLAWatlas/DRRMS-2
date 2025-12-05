import { desc } from "drizzle-orm";
import { createHash, createHmac } from "crypto";
import { getDb } from "../db";
import { transparencyLedger } from "../db/schema";

const SIGNING_SECRET = process.env.TRANSPARENCY_SIGNING_SECRET || process.env.JWT_SECRET || "drrms-sign";

type LedgerRow = typeof transparencyLedger.$inferSelect;

export type AppendLedgerEntryInput = {
  entryType: string;
  payload: unknown;
  metadata?: Record<string, unknown> | null;
  actorId?: number | null;
};

export type LedgerEntryDTO = {
  id: number;
  entryType: string;
  payload: unknown;
  payloadHash: string;
  previousHash: string | null;
  entryHash: string;
  signature: string | null;
  createdAt: number;
  actorId: number | null;
  metadata: Record<string, unknown> | null;
  verified: boolean;
};

export async function appendLedgerEntry(input: AppendLedgerEntryInput): Promise<LedgerEntryDTO> {
  const db = getDb();
  const payloadValue = input.payload ?? {};
  const payloadString = stringifyJson(payloadValue);
  const metadataString = input.metadata ? stringifyJson(input.metadata) : null;
  const payloadHash = hashSha256(payloadString);

  const [latest] = await db.select().from(transparencyLedger).orderBy(desc(transparencyLedger.id)).limit(1);
  const previousHash = latest?.entryHash ?? null;
  const createdAt = Date.now();
  const entryHash = hashSha256(
    canonicalString({
      entryType: input.entryType,
      payloadHash,
      previousHash,
      createdAt,
      metadata: metadataString,
    }),
  );
  const signature = createSignature(entryHash);

  const [inserted] = await db
    .insert(transparencyLedger)
    .values({
      entryType: input.entryType,
      payload: payloadString,
      payloadHash,
      previousHash,
      entryHash,
      signature,
      actorId: input.actorId ?? null,
      metadata: metadataString,
      createdAt,
    })
    .returning();

  return {
    id: inserted.id,
    entryType: inserted.entryType,
    payload: payloadValue,
    payloadHash,
    previousHash,
    entryHash,
    signature,
    createdAt,
    actorId: inserted.actorId ?? null,
    metadata: input.metadata ?? null,
    verified: true,
  };
}

export async function getLedgerEntries(limit = 50): Promise<LedgerEntryDTO[]> {
  const sanitizedLimit = Math.max(1, Math.min(500, limit));
  const db = getDb();
  const rows = await db
    .select()
    .from(transparencyLedger)
    .orderBy(desc(transparencyLedger.id))
    .limit(sanitizedLimit);

  const verificationMap = verifyLedgerRows(rows);

  return rows.map((row) => ({
    id: row.id,
    entryType: row.entryType,
    payload: parsePayload(row.payload),
    payloadHash: row.payloadHash,
    previousHash: row.previousHash,
    entryHash: row.entryHash,
    signature: row.signature,
    createdAt: row.createdAt,
    actorId: row.actorId,
    metadata: parseMetadata(row.metadata),
    verified: verificationMap.get(row.id) ?? false,
  }));
}

function verifyLedgerRows(rows: LedgerRow[]) {
  const byAsc = [...rows].sort((a, b) => a.id - b.id);
  const verification = new Map<number, boolean>();
  let previousEntryHash: string | null = null;

  for (const row of byAsc) {
    const computedPayloadHash = hashSha256(row.payload);
    const canonical = canonicalString({
      entryType: row.entryType,
      payloadHash: row.payloadHash,
      previousHash: row.previousHash,
      createdAt: row.createdAt,
      metadata: row.metadata,
    });
    const computedEntryHash = hashSha256(canonical);
    const expectedSignature = row.signature ? createSignature(computedEntryHash) : null;

    const chainValid = row.previousHash === previousEntryHash;
    const payloadValid = computedPayloadHash === row.payloadHash;
    const entryValid = computedEntryHash === row.entryHash;
    const signatureValid = row.signature ? expectedSignature === row.signature : true;
    const isValid = chainValid && payloadValid && entryValid && signatureValid;

    verification.set(row.id, isValid);
    previousEntryHash = row.entryHash;
  }

  return verification;
}

function stringifyJson(value: unknown) {
  try {
    return JSON.stringify(value ?? null);
  } catch (_error) {
    return JSON.stringify({ error: "unserializable" });
  }
}

function canonicalString(params: {
  entryType: string;
  payloadHash: string;
  previousHash: string | null;
  createdAt: number;
  metadata: string | null;
}) {
  return JSON.stringify({
    entryType: params.entryType,
    payloadHash: params.payloadHash,
    previousHash: params.previousHash,
    createdAt: params.createdAt,
    metadata: params.metadata,
  });
}

function hashSha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createSignature(entryHash: string) {
  return createHmac("sha256", SIGNING_SECRET).update(entryHash).digest("hex");
}

function parsePayload(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function parseMetadata(value: string | null): Record<string, unknown> | null {
  const parsed = parsePayload(value);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return null;
}
