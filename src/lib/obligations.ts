import { neonClient } from "@/lib/neon";

const TZ = "America/Chicago";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// The obligation engine.
//
// Everything in her life with a future date lives here — assignments, bills,
// paydays, appointments, product cycles, haircuts, schedule blocks. Each row
// carries its own lead times, so the engine doesn't need to know what an
// assignment is versus a hair appointment: it just asks "what is crossing a
// threshold right now" and says the one thing worth saying.
//
// This replaces the fixed-alarm model. Adding a new kind of reminder becomes a
// row, not new code.
// ─────────────────────────────────────────────────────────────────────────────

export type Source = "school" | "finance" | "skincare" | "life" | "health" | "exposure" | "schedule";

export interface Obligation {
  id: string;
  source: Source;
  kind: string;
  title: string;
  detail: string;
  dueAt: string;
  leadDays: number[];
  repeatDays: number | null;
  notified: string[];
  externalId: string | null;
  active: boolean;
}

export async function ensureObligations() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS obligations (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      source      TEXT NOT NULL,
      kind        TEXT NOT NULL,
      title       TEXT NOT NULL,
      detail      TEXT DEFAULT '',
      due_at      TIMESTAMPTZ NOT NULL,
      lead_days   INTEGER[] NOT NULL DEFAULT '{7,3,1,0}',
      repeat_days INTEGER,
      notified    TEXT[] NOT NULL DEFAULT '{}',
      external_id TEXT,
      active      BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS obligations_ext_idx ON obligations (external_id) WHERE external_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS obligations_due_idx ON obligations (due_at) WHERE active`;
}

function fromRow(r: Record<string, unknown>): Obligation {
  return {
    id: r.id as string,
    source: r.source as Source,
    kind: r.kind as string,
    title: r.title as string,
    detail: (r.detail as string) ?? "",
    dueAt: String(r.due_at),
    leadDays: (r.lead_days as number[]) ?? [],
    repeatDays: r.repeat_days === null ? null : Number(r.repeat_days),
    notified: (r.notified as string[]) ?? [],
    externalId: (r.external_id as string) ?? null,
    active: Boolean(r.active),
  };
}

export async function upsertObligation(o: {
  source: Source; kind: string; title: string; detail?: string;
  dueAt: string; leadDays?: number[]; repeatDays?: number | null; externalId?: string | null;
}): Promise<void> {
  await ensureObligations();
  const sql = db();
  const lead = o.leadDays ?? [7, 3, 1, 0];

  if (o.externalId) {
    // Re-reading the same email must update, never duplicate
    await sql`
      INSERT INTO obligations (source, kind, title, detail, due_at, lead_days, repeat_days, external_id)
      VALUES (${o.source}, ${o.kind}, ${o.title}, ${o.detail ?? ""}, ${o.dueAt},
              ${lead}, ${o.repeatDays ?? null}, ${o.externalId})
      ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO UPDATE SET
        title = EXCLUDED.title, detail = EXCLUDED.detail, due_at = EXCLUDED.due_at
    `;
    return;
  }
  await sql`
    INSERT INTO obligations (source, kind, title, detail, due_at, lead_days, repeat_days)
    VALUES (${o.source}, ${o.kind}, ${o.title}, ${o.detail ?? ""}, ${o.dueAt},
            ${lead}, ${o.repeatDays ?? null})
  `;
}

export async function listObligations(includeDone = false): Promise<Obligation[]> {
  await ensureObligations();
  const sql = db();
  const rows = includeDone
    ? await sql`SELECT * FROM obligations ORDER BY due_at ASC LIMIT 200`
    : await sql`SELECT * FROM obligations WHERE active ORDER BY due_at ASC LIMIT 200`;
  return rows.map(fromRow);
}

export async function completeObligation(id: string): Promise<void> {
  await ensureObligations();
  const sql = db();
  const rows = await sql`SELECT * FROM obligations WHERE id = ${id}`;
  if (!rows.length) return;
  const o = fromRow(rows[0]);

  if (o.kind === "birthday") {
    // Same calendar date next year — arithmetic on 365 drifts
    const d = new Date(o.dueAt);
    d.setFullYear(d.getFullYear() + 1);
    await sql`UPDATE obligations SET due_at = ${d.toISOString()}, notified = '{}' WHERE id = ${id}`;
  } else if (o.repeatDays) {
    // Recurring things roll forward from today, not from the old due date —
    // getting your hair done late shouldn't compress the next cycle
    const next = new Date(Date.now() + o.repeatDays * 86400000).toISOString();
    await sql`UPDATE obligations SET due_at = ${next}, notified = '{}' WHERE id = ${id}`;
  } else {
    await sql`UPDATE obligations SET active = false WHERE id = ${id}`;
  }
}

export async function deleteObligation(id: string): Promise<void> {
  const sql = db();
  await sql`DELETE FROM obligations WHERE id = ${id}`;
}

// ─── The scan ────────────────────────────────────────────────────────────────

function daysUntil(dueAt: string): number {
  const due = new Date(dueAt).getTime();
  return Math.floor((due - Date.now()) / 86400000);
}

// A notification that says "in 93 days" makes her count forward from today.
// Naming the day does the work for her.
function phrase(o: Obligation, days: number): string {
  const d = new Date(o.dueAt);
  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ });
  const when =
    days < 0  ? `overdue since ${dateStr}` :
    days === 0 ? "today" :
    days === 1 ? "tomorrow" :
    days <= 6  ? d.toLocaleDateString("en-US", { weekday: "long", timeZone: TZ }) :
    `on ${dateStr}`;

  const lead: Record<string, (t: string, w: string, d: string) => string> = {
    assignment: (t, w, d) => `${t} is due ${w}.${d ? ` ${d}` : " Start it in tonight's Block 1."}`,
    exam: (t, w, d) => `${t} — ${w}.${d ? ` ${d}` : ""}`,
    bill: (t, w, d) => `${t} due ${w}${d ? ` · ${d}` : ""}.`,
    payday: (t, w) => `${t} ${w === "today" ? "hit today" : w}. 30-min budget check before the weekend.`,
    appointment: (t, w, d) => `${t} ${w}${d ? ` · ${d}` : ""}.`,
    "product-cycle": (t, w, d) => `${t} — ${w}. ${d}`,
    refill: (t, w) => `${t} runs out ${w} — reorder now.`,
    haircut: (t, w) => `${t} — ${w}. Book it before the week fills up.`,
    birthday: (t, w, d) => w === "today"
      ? `${t} is TODAY. Call ${t.replace(/'s birthday$/, "")}${d ? ` — your ${d}` : ""}.`
      : `${t} — ${w}. ${w === "tomorrow" ? "Text tonight so you're not the late one." : "Enough time to actually get something."}`,
    call: (t, w) => `${t}${w === "today" ? " today" : ` — ${w}`}. Ten minutes counts.`,
    maintenance: (t, w, d) => `${t} ${w}${d ? ` · ${d}` : ""}.`,
  };

  const f = lead[o.kind];
  return f ? f(o.title, when, o.detail) : `${o.title} — ${when}${o.detail ? ` · ${o.detail}` : ""}`;
}

/**
 * Everything crossing a lead threshold right now. Each (obligation, stage)
 * fires exactly once; recurring items reset their stages when they roll over.
 */
export async function dueNotifications(): Promise<Array<{ id: string; stage: string; message: string }>> {
  await ensureObligations();
  const sql = db();
  const rows = await sql`
    SELECT * FROM obligations
    WHERE active AND due_at < NOW() + INTERVAL '30 days'
    ORDER BY due_at ASC
  `;

  const out: Array<{ id: string; stage: string; message: string }> = [];

  for (const raw of rows) {
    const o = fromRow(raw);
    const days = daysUntil(o.dueAt);

    // Auto-roll a recurring item that has slipped more than a day past due
    if (days < -1 && o.repeatDays) {
      let nextDate: Date;
      if (o.kind === "birthday") {
        nextDate = new Date(o.dueAt);
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      } else {
        nextDate = new Date(Date.now() + o.repeatDays * 86400000);
      }
      const next = nextDate.toISOString();
      await sql`UPDATE obligations SET due_at = ${next}, notified = '{}' WHERE id = ${o.id}`;
      continue;
    }

    // Largest lead threshold we've reached and not yet sent
    const hit = [...o.leadDays]
      .sort((a, b) => b - a)
      .find(l => days <= l && !o.notified.includes(String(l)));

    if (hit === undefined) continue;
    out.push({ id: o.id, stage: String(hit), message: phrase(o, days) });
  }
  return out;
}

export async function markNotified(id: string, stage: string): Promise<void> {
  const sql = db();
  await sql`UPDATE obligations SET notified = array_append(notified, ${stage}) WHERE id = ${id}`;
}
