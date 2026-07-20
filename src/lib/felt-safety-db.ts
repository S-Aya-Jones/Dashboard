import { neon } from "@neondatabase/serverless";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export async function ensureFeltSafetyTables() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS twitch_logs (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL DEFAULT 'aya',
      trigger_type TEXT NOT NULL,
      intensity    INT  NOT NULL,
      acted        BOOLEAN NOT NULL,
      note         TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export interface TwitchLog {
  id: string;
  userId: string;
  triggerType: string;
  intensity: number;
  acted: boolean;
  note?: string;
  createdAt: string;
}

export async function insertTwitchLog(
  log: Pick<TwitchLog, "id" | "triggerType" | "intensity" | "acted" | "note">
): Promise<TwitchLog> {
  await ensureFeltSafetyTables();
  const sql = getDb();
  const rows = await sql`
    INSERT INTO twitch_logs (id, trigger_type, intensity, acted, note)
    VALUES (${log.id}, ${log.triggerType}, ${log.intensity}, ${log.acted}, ${log.note ?? null})
    RETURNING id, user_id, trigger_type, intensity, acted, note, created_at
  `;
  return rowToLog(rows[0]);
}

export async function getTwitchLogs(userId = "aya", limit = 1000): Promise<TwitchLog[]> {
  await ensureFeltSafetyTables();
  const sql = getDb();
  const rows = await sql`
    SELECT id, user_id, trigger_type, intensity, acted, note, created_at
    FROM twitch_logs
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(rowToLog);
}

function rowToLog(row: Record<string, unknown>): TwitchLog {
  return {
    id:          row.id as string,
    userId:      row.user_id as string,
    triggerType: row.trigger_type as string,
    intensity:   row.intensity as number,
    acted:       row.acted as boolean,
    note:        (row.note as string) ?? undefined,
    createdAt:   (row.created_at as Date).toISOString(),
  };
}
