import { neonClient } from "@/lib/neon";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

async function ensureTable() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS app_keys (
      name       TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

// Keys pasted into the app UI live here so no Vercel env editing or redeploy
// is needed. Env vars still win when present.
export async function getAppKey(name: string): Promise<string | null> {
  const envValue = process.env[name];
  if (envValue) return envValue;
  try {
    await ensureTable();
    const sql = db();
    const rows = await sql`SELECT value FROM app_keys WHERE name = ${name}`;
    return rows.length ? (rows[0].value as string) : null;
  } catch {
    return null;
  }
}

export async function setAppKey(name: string, value: string): Promise<void> {
  await ensureTable();
  const sql = db();
  await sql`
    INSERT INTO app_keys (name, value, updated_at) VALUES (${name}, ${value}, NOW())
    ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}

export async function clearAppKey(name: string): Promise<void> {
  await ensureTable();
  const sql = db();
  await sql`DELETE FROM app_keys WHERE name = ${name}`;
}

// Never returns the secret itself — only whether one exists and where from.
export async function appKeyStatus(name: string) {
  if (process.env[name]) return { configured: true, source: "env" as const, hint: null };
  try {
    await ensureTable();
    const sql = db();
    const rows = await sql`SELECT value FROM app_keys WHERE name = ${name}`;
    if (!rows.length) return { configured: false, source: null, hint: null };
    const v = rows[0].value as string;
    return { configured: true, source: "app" as const, hint: `…${v.slice(-4)}` };
  } catch {
    return { configured: false, source: null, hint: null };
  }
}
