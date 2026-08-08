import { neonClient } from "@/lib/neon";
import { DashboardData, defaultDashboardData } from "@/types/dashboard";
import { externalisePhotos } from "@/lib/media";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

let tableReady = false;
async function ensureTable() {
  // Running CREATE TABLE IF NOT EXISTS on every read and write is itself
  // traffic against the quota. Once per process is enough.
  if (tableReady) return;
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS dashboard_data (
      user_id TEXT PRIMARY KEY,
      data    JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  tableReady = true;
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
  // Merge with defaults so any newly added fields are never undefined
  const defaults = defaultDashboardData();
  return { ...defaults, ...(rows[0].data as DashboardData) };
}

export async function saveData(data: DashboardData): Promise<void> {
  await ensureTable();
  const sql = getDb();

  // Photos are megabytes each as base64. Left in the blob they get rewritten
  // on every single change, which is what exhausted the transfer quota.
  const workout = data.workout
    ? {
        ...data.workout,
        bodyScanPhotos:  await externalisePhotos(data.workout.bodyScanPhotos),
        formCheckPhotos: await externalisePhotos(data.workout.formCheckPhotos),
      }
    : data.workout;

  const payload = { ...data, workout, updatedAt: new Date().toISOString() };
  await sql`
    INSERT INTO dashboard_data (user_id, data, updated_at)
    VALUES (${data.userId}, ${JSON.stringify(payload)}, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET data = ${JSON.stringify(payload)}, updated_at = NOW()
  `;
}
