import { neon } from "@neondatabase/serverless";
import { DashboardData, defaultDashboardData } from "@/types/dashboard";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

async function ensureTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS dashboard_data (
      user_id TEXT PRIMARY KEY,
      data    JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function loadData(userId = "aya"): Promise<DashboardData> {
  await ensureTable();
  const sql = getDb();
  const rows = await sql`SELECT data FROM dashboard_data WHERE user_id = ${userId}`;
  if (rows.length === 0) {
    const fresh = defaultDashboardData();
    await sql`
      INSERT INTO dashboard_data (user_id, data)
      VALUES (${userId}, ${JSON.stringify(fresh)})
    `;
    return fresh;
  }
  return rows[0].data as DashboardData;
}

export async function saveData(data: DashboardData): Promise<void> {
  await ensureTable();
  const sql = getDb();
  const payload = { ...data, updatedAt: new Date().toISOString() };
  await sql`
    INSERT INTO dashboard_data (user_id, data, updated_at)
    VALUES (${data.userId}, ${JSON.stringify(payload)}, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET data = ${JSON.stringify(payload)}, updated_at = NOW()
  `;
}
