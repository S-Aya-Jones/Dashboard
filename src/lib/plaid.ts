import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { neon } from "@neondatabase/serverless";

// ── Plaid client ─────────────────────────────────────────────────────────────

export function getPlaidClient() {
  const env = (process.env.PLAID_ENV ?? "sandbox") as keyof typeof PlaidEnvironments;
  const cfg = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
        "PLAID-SECRET":    process.env.PLAID_SECRET!,
      },
    },
  });
  return new PlaidApi(cfg);
}

// ── AES-256-GCM encryption (key derived from PLAID_SECRET) ───────────────────

const ALGO = "aes-256-gcm";

function derivedKey(): Buffer {
  return createHash("sha256").update(process.env.PLAID_SECRET ?? "dev-fallback").digest();
}

export function encryptToken(plain: string): string {
  const key = derivedKey();
  const iv  = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc  = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag  = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptToken(encrypted: string): string {
  const [ivHex, tagHex, encHex] = encrypted.split(":");
  const key = derivedKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = decipher.update(Buffer.from(encHex, "hex"));
  return Buffer.concat([dec, decipher.final()]).toString("utf8");
}

// ── plaid_items table ────────────────────────────────────────────────────────

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

async function ensurePlaidTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS plaid_items (
      item_id          TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL DEFAULT 'aya',
      access_token_enc TEXT NOT NULL,
      institution_id   TEXT,
      institution_name TEXT,
      added_at         TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export interface PlaidItemRow {
  item_id:          string;
  user_id:          string;
  access_token_enc: string;
  institution_id:   string | null;
  institution_name: string | null;
}

export async function getPlaidItems(userId = "aya"): Promise<PlaidItemRow[]> {
  await ensurePlaidTable();
  const sql = getDb();
  const rows = await sql`SELECT * FROM plaid_items WHERE user_id = ${userId}`;
  return rows as PlaidItemRow[];
}

export async function upsertPlaidItem(
  itemId:          string,
  accessToken:     string,
  institutionId:   string | null,
  institutionName: string | null,
  userId = "aya",
) {
  await ensurePlaidTable();
  const sql = getDb();
  const enc = encryptToken(accessToken);
  await sql`
    INSERT INTO plaid_items (item_id, user_id, access_token_enc, institution_id, institution_name)
    VALUES (${itemId}, ${userId}, ${enc}, ${institutionId}, ${institutionName})
    ON CONFLICT (item_id) DO UPDATE SET
      access_token_enc = ${enc},
      institution_id   = ${institutionId},
      institution_name = ${institutionName}
  `;
}

export async function deletePlaidItem(itemId: string) {
  await ensurePlaidTable();
  const sql = getDb();
  await sql`DELETE FROM plaid_items WHERE item_id = ${itemId}`;
}
