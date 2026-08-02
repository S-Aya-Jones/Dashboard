import { neon } from "@neondatabase/serverless";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

// ─── Twitch Logs ──────────────────────────────────────────────────────────────

export async function ensureTwitchTable() {
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
  id: string; userId: string; triggerType: string;
  intensity: number; acted: boolean; note?: string; createdAt: string;
}

export async function insertTwitchLog(
  log: Pick<TwitchLog, "id" | "triggerType" | "intensity" | "acted" | "note">
): Promise<TwitchLog> {
  await ensureTwitchTable();
  const sql = getDb();
  const rows = await sql`
    INSERT INTO twitch_logs (id, trigger_type, intensity, acted, note)
    VALUES (${log.id}, ${log.triggerType}, ${log.intensity}, ${log.acted}, ${log.note ?? null})
    RETURNING id, user_id, trigger_type, intensity, acted, note, created_at
  `;
  return twitchFromRow(rows[0]);
}

export async function getTwitchLogs(userId = "aya", limit = 1000): Promise<TwitchLog[]> {
  await ensureTwitchTable();
  const sql = getDb();
  const rows = await sql`
    SELECT id, user_id, trigger_type, intensity, acted, note, created_at
    FROM twitch_logs WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows.map(twitchFromRow);
}

function twitchFromRow(r: Record<string, unknown>): TwitchLog {
  return { id: r.id as string, userId: r.user_id as string, triggerType: r.trigger_type as string,
    intensity: r.intensity as number, acted: r.acted as boolean,
    note: (r.note as string) ?? undefined, createdAt: (r.created_at as Date).toISOString() };
}

// ─── Rep Cards ────────────────────────────────────────────────────────────────

const SEED_CARDS = [
  // Tier 1
  { id: "rc-t1-1", title: "The 2-Hour Hold",            instruction: "Let a text message sit unanswered for 2 hours before replying.",                                                             tier: 1, category: "digital" },
  { id: "rc-t1-2", title: "No Tracking",                instruction: "Don't check anyone's location, activity status, or \"last seen\" today.",                                                    tier: 1, category: "monitoring" },
  { id: "rc-t1-3", title: "Let Them Choose",            instruction: "Let someone else pick the restaurant or plan without offering input.",                                                       tier: 1, category: "directing" },
  { id: "rc-t1-4", title: "Name It, Leave It",          instruction: "Notice one scorekeeping thought today and just name it — no action required.",                                               tier: 1, category: "scorekeeping" },
  // Tier 2
  { id: "rc-t2-1", title: "Wait for the Invite",        instruction: "Don't be the one to ask \"what days are we hanging out this week?\" — let your partner bring it up.",                       tier: 2, category: "preloading" },
  { id: "rc-t2-2", title: "Delayed Return",             instruction: "Let a call go unreturned until tomorrow.",                                                                                   tier: 2, category: "digital" },
  { id: "rc-t2-3", title: "No First Contact",           instruction: "Don't be the first to call or text a specific person today.",                                                               tier: 2, category: "monitoring" },
  { id: "rc-t2-4", title: "No Steering",                instruction: "When a friend mentions plans with someone else, say nothing steering — just \"that sounds fun.\"",                          tier: 2, category: "directing" },
  { id: "rc-t2-5", title: "Skip the Follow-Up",        instruction: "Skip asking a follow-up question you'd normally ask to get information or reassurance.",                                    tier: 2, category: "monitoring" },
  { id: "rc-t2-6", title: "The 24-Hour Hold",           instruction: "When a grievance appears today, write it in the app instead of raising it. Tomorrow, reread it and decide: still worth airing, or evaporated?", tier: 2, category: "airing" },
  // Tier 3
  { id: "rc-t3-1", title: "Radio Silence",              instruction: "Go the full day without initiating contact with anyone — let connection come to you.",                                       tier: 3, category: "monitoring" },
  { id: "rc-t3-2", title: "Sleep on It",                instruction: "Sit with an unresolved disagreement overnight without re-litigating it.",                                                   tier: 3, category: "airing" },
  { id: "rc-t3-3", title: "Give Instead",               instruction: "When you feel owed something today, deliberately give something small instead.",                                             tier: 3, category: "owed" },
  { id: "rc-t3-4", title: "Hands Off the Week",         instruction: "Let an entire week's plans form without you organizing any of it.",                                                         tier: 3, category: "directing" },
];

const SEED_MANTRAS = [
  { id: "m-1", text: "I can feel unsafe and be okay at the same time.",    faithFlag: false },
  { id: "m-2", text: "Control isn't safety. Trust is the rep.",             faithFlag: false },
  { id: "m-3", text: "I release what I was never holding.",                 faithFlag: false },
  { id: "m-4", text: "Let it be given, not taken.",                         faithFlag: false },
  { id: "m-5", text: "God's got it. My hands can rest.",                    faithFlag: true  },
  { id: "m-6", text: "The urge is information, not instruction.",            faithFlag: false },
];

export async function ensureRepCardsTables() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS rep_cards (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      instruction TEXT NOT NULL,
      tier        INT  NOT NULL DEFAULT 1,
      category    TEXT NOT NULL DEFAULT 'general',
      custom      BOOLEAN NOT NULL DEFAULT false,
      rating_sum  FLOAT   NOT NULL DEFAULT 0,
      rating_count INT    NOT NULL DEFAULT 0,
      times_drawn INT     NOT NULL DEFAULT 0,
      active      BOOLEAN NOT NULL DEFAULT true
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS rep_completions (
      id           TEXT PRIMARY KEY,
      card_id      TEXT NOT NULL,
      before_score INT  NOT NULL,
      after_score  INT  NOT NULL,
      note         TEXT,
      redrawn      BOOLEAN NOT NULL DEFAULT false,
      completed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS card_draws (
      id         TEXT PRIMARY KEY,
      card_id    TEXT NOT NULL,
      drawn_date DATE NOT NULL DEFAULT CURRENT_DATE,
      redrawn    BOOLEAN NOT NULL DEFAULT false
    )
  `;
  // Seed cards if table is empty
  const existing = await sql`SELECT COUNT(*) as cnt FROM rep_cards WHERE custom = false`;
  if (Number(existing[0].cnt) === 0) {
    for (const card of SEED_CARDS) {
      await sql`
        INSERT INTO rep_cards (id, title, instruction, tier, category, custom)
        VALUES (${card.id}, ${card.title}, ${card.instruction}, ${card.tier}, ${card.category}, false)
        ON CONFLICT (id) DO NOTHING
      `;
    }
  }
}

export interface RepCard {
  id: string; title: string; instruction: string; tier: number; category: string;
  custom: boolean; ratingAvg: number; timesDrawn: number; active: boolean;
}

export interface RepCompletion {
  id: string; cardId: string; beforeScore: number; afterScore: number;
  note?: string; redrawn: boolean; completedAt: string;
}

export async function getRepCards(): Promise<RepCard[]> {
  await ensureRepCardsTables();
  const sql = getDb();
  const rows = await sql`SELECT * FROM rep_cards WHERE active = true ORDER BY tier, id`;
  return rows.map(repCardFromRow);
}

export async function insertRepCard(card: Omit<RepCard, "ratingAvg" | "timesDrawn">): Promise<RepCard> {
  await ensureRepCardsTables();
  const sql = getDb();
  const rows = await sql`
    INSERT INTO rep_cards (id, title, instruction, tier, category, custom, active)
    VALUES (${card.id}, ${card.title}, ${card.instruction}, ${card.tier}, ${card.category}, ${card.custom}, true)
    RETURNING *
  `;
  return repCardFromRow(rows[0]);
}

export async function getTodayDraw(): Promise<{ cardId: string; redrawn: boolean } | null> {
  await ensureRepCardsTables();
  const sql = getDb();
  const rows = await sql`
    SELECT card_id, redrawn FROM card_draws
    WHERE drawn_date = CURRENT_DATE ORDER BY redrawn DESC LIMIT 1
  `;
  if (rows.length === 0) return null;
  return { cardId: rows[0].card_id as string, redrawn: rows[0].redrawn as boolean };
}

export async function drawCard(completionCount: number): Promise<RepCard> {
  await ensureRepCardsTables();
  const sql = getDb();
  // Tier unlock: Tier2 at 5+, Tier3 at 15+
  const maxTier = completionCount >= 15 ? 3 : completionCount >= 5 ? 2 : 1;
  // Weighted random: rating_avg + 1 as weight (higher-rated = slightly more likely)
  const cards = await sql`
    SELECT rc.*, COALESCE(rc.rating_sum / NULLIF(rc.rating_count, 0), 3) as avg_rating
    FROM rep_cards rc
    WHERE rc.active = true AND rc.tier <= ${maxTier}
    ORDER BY RANDOM() * (COALESCE(rc.rating_sum / NULLIF(rc.rating_count, 0), 3) + 1) DESC
    LIMIT 1
  `;
  const card = repCardFromRow(cards[0]);
  // Record the draw
  await sql`
    INSERT INTO card_draws (id, card_id, drawn_date)
    VALUES (${crypto.randomUUID()}, ${card.id}, CURRENT_DATE)
  `;
  await sql`UPDATE rep_cards SET times_drawn = times_drawn + 1 WHERE id = ${card.id}`;
  return card;
}

export async function redrawCard(completionCount: number): Promise<RepCard | null> {
  await ensureRepCardsTables();
  const sql = getDb();
  // Only allow one redraw per day
  const draws = await sql`SELECT COUNT(*) as cnt FROM card_draws WHERE drawn_date = CURRENT_DATE`;
  if (Number(draws[0].cnt) >= 2) return null; // already redrawn
  const maxTier = completionCount >= 15 ? 3 : completionCount >= 5 ? 2 : 1;
  const currentDraw = await sql`SELECT card_id FROM card_draws WHERE drawn_date = CURRENT_DATE LIMIT 1`;
  const currentCardId = currentDraw.length > 0 ? (currentDraw[0].card_id as string) : null;
  const cards = await sql`
    SELECT rc.*
    FROM rep_cards rc
    WHERE rc.active = true AND rc.tier <= ${maxTier} AND rc.id != ${currentCardId ?? ""}
    ORDER BY RANDOM() LIMIT 1
  `;
  if (cards.length === 0) return null;
  const card = repCardFromRow(cards[0]);
  await sql`
    INSERT INTO card_draws (id, card_id, drawn_date, redrawn)
    VALUES (${crypto.randomUUID()}, ${card.id}, CURRENT_DATE, true)
  `;
  await sql`UPDATE rep_cards SET times_drawn = times_drawn + 1 WHERE id = ${card.id}`;
  return card;
}

export async function completeRepCard(
  cardId: string, beforeScore: number, afterScore: number, note?: string
): Promise<RepCompletion> {
  await ensureRepCardsTables();
  const sql = getDb();
  const rows = await sql`
    INSERT INTO rep_completions (id, card_id, before_score, after_score, note)
    VALUES (${crypto.randomUUID()}, ${cardId}, ${beforeScore}, ${afterScore}, ${note ?? null})
    RETURNING *
  `;
  return completionFromRow(rows[0]);
}

export async function rateRepCard(cardId: string, rating: number): Promise<void> {
  await ensureRepCardsTables();
  const sql = getDb();
  await sql`
    UPDATE rep_cards SET rating_sum = rating_sum + ${rating}, rating_count = rating_count + 1
    WHERE id = ${cardId}
  `;
}

export async function getRepCompletions(limit = 200): Promise<RepCompletion[]> {
  await ensureRepCardsTables();
  const sql = getDb();
  const rows = await sql`SELECT * FROM rep_completions ORDER BY completed_at DESC LIMIT ${limit}`;
  return rows.map(completionFromRow);
}

function repCardFromRow(r: Record<string, unknown>): RepCard {
  const ratingSum   = (r.rating_sum as number) ?? 0;
  const ratingCount = (r.rating_count as number) ?? 0;
  return { id: r.id as string, title: r.title as string, instruction: r.instruction as string,
    tier: r.tier as number, category: r.category as string, custom: r.custom as boolean,
    ratingAvg: ratingCount > 0 ? ratingSum / ratingCount : 0,
    timesDrawn: (r.times_drawn as number) ?? 0, active: r.active as boolean };
}

function completionFromRow(r: Record<string, unknown>): RepCompletion {
  return { id: r.id as string, cardId: r.card_id as string, beforeScore: r.before_score as number,
    afterScore: r.after_score as number, note: (r.note as string) ?? undefined,
    redrawn: r.redrawn as boolean, completedAt: (r.completed_at as Date).toISOString() };
}

// ─── Parking Lot ──────────────────────────────────────────────────────────────

export async function ensureParkingLotTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS parking_lot (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL DEFAULT 'aya',
      content    TEXT NOT NULL,
      decision   TEXT,
      decided_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export interface ParkingLotEntry {
  id: string; userId: string; content: string;
  decision?: "raise" | "let_go"; decidedAt?: string; createdAt: string;
}

export async function getParkingLotEntries(userId = "aya"): Promise<ParkingLotEntry[]> {
  await ensureParkingLotTable();
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM parking_lot WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 100
  `;
  return rows.map(parkingFromRow);
}

export async function insertParkingLotEntry(content: string): Promise<ParkingLotEntry> {
  await ensureParkingLotTable();
  const sql = getDb();
  const rows = await sql`
    INSERT INTO parking_lot (id, content) VALUES (${crypto.randomUUID()}, ${content}) RETURNING *
  `;
  return parkingFromRow(rows[0]);
}

export async function decideParkingLotEntry(
  id: string, decision: "raise" | "let_go"
): Promise<ParkingLotEntry> {
  await ensureParkingLotTable();
  const sql = getDb();
  const rows = await sql`
    UPDATE parking_lot SET decision = ${decision}, decided_at = NOW()
    WHERE id = ${id} RETURNING *
  `;
  return parkingFromRow(rows[0]);
}

function parkingFromRow(r: Record<string, unknown>): ParkingLotEntry {
  return { id: r.id as string, userId: r.user_id as string, content: r.content as string,
    decision: (r.decision as "raise" | "let_go") ?? undefined,
    decidedAt: r.decided_at ? (r.decided_at as Date).toISOString() : undefined,
    createdAt: (r.created_at as Date).toISOString() };
}

// ─── Check-ins ────────────────────────────────────────────────────────────────

export async function ensureCheckinsTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS felt_checkins (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL DEFAULT 'aya',
      answer     TEXT NOT NULL,
      day_rating TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export interface Checkin {
  id: string; userId: string; answer: string; dayRating: string; createdAt: string;
}

export async function getCheckins(userId = "aya", limit = 90): Promise<Checkin[]> {
  await ensureCheckinsTable();
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM felt_checkins WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows.map(checkinFromRow);
}

export async function insertCheckin(answer: string, dayRating: string): Promise<Checkin> {
  await ensureCheckinsTable();
  const sql = getDb();
  const rows = await sql`
    INSERT INTO felt_checkins (id, answer, day_rating) VALUES (${crypto.randomUUID()}, ${answer}, ${dayRating}) RETURNING *
  `;
  return checkinFromRow(rows[0]);
}

function checkinFromRow(r: Record<string, unknown>): Checkin {
  return { id: r.id as string, userId: r.user_id as string,
    answer: r.answer as string, dayRating: r.day_rating as string,
    createdAt: (r.created_at as Date).toISOString() };
}

// ─── Mantras ─────────────────────────────────────────────────────────────────

export async function ensureMantrasTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS felt_mantras (
      id         TEXT PRIMARY KEY,
      text       TEXT NOT NULL,
      faith_flag BOOLEAN NOT NULL DEFAULT false,
      custom     BOOLEAN NOT NULL DEFAULT false,
      active     BOOLEAN NOT NULL DEFAULT true
    )
  `;
  const existing = await sql`SELECT COUNT(*) as cnt FROM felt_mantras WHERE custom = false`;
  if (Number(existing[0].cnt) === 0) {
    for (const m of SEED_MANTRAS) {
      await sql`
        INSERT INTO felt_mantras (id, text, faith_flag, custom)
        VALUES (${m.id}, ${m.text}, ${m.faithFlag}, false)
        ON CONFLICT (id) DO NOTHING
      `;
    }
  }
}

export interface Mantra {
  id: string; text: string; faithFlag: boolean; custom: boolean; active: boolean;
}

export async function getMantras(faithMode?: boolean): Promise<Mantra[]> {
  await ensureMantrasTable();
  const sql = getDb();
  const rows = faithMode === undefined
    ? await sql`SELECT * FROM felt_mantras WHERE active = true ORDER BY id`
    : await sql`SELECT * FROM felt_mantras WHERE active = true AND faith_flag = ${faithMode} ORDER BY id`;
  return rows.map(mantraFromRow);
}

export async function insertMantra(text: string, faithFlag: boolean): Promise<Mantra> {
  await ensureMantrasTable();
  const sql = getDb();
  const rows = await sql`
    INSERT INTO felt_mantras (id, text, faith_flag, custom)
    VALUES (${crypto.randomUUID()}, ${text}, ${faithFlag}, true) RETURNING *
  `;
  return mantraFromRow(rows[0]);
}

export async function getCurrentMantra(faithMode?: boolean): Promise<Mantra | null> {
  const mantras = await getMantras(faithMode);
  if (mantras.length === 0) return null;
  // Rotate by hour-of-day so it changes through the day
  const idx = Math.floor(Date.now() / (1000 * 60 * 60)) % mantras.length;
  return mantras[idx];
}

function mantraFromRow(r: Record<string, unknown>): Mantra {
  return { id: r.id as string, text: r.text as string,
    faithFlag: r.faith_flag as boolean, custom: r.custom as boolean, active: r.active as boolean };
}

// ─── Aggregate stats (for Garden) ────────────────────────────────────────────

export interface FeltSafetyStats {
  totalResisted: number;
  totalActed: number;
  completedReps: number;
  checkinsStreak: number;
  hasCompletedTier3: boolean;
  parkingLetGoCount: number;
}

export async function getFeltSafetyStats(): Promise<FeltSafetyStats> {
  await Promise.all([ensureTwitchTable(), ensureRepCardsTables(), ensureCheckinsTable(), ensureParkingLotTable()]);
  const sql = getDb();

  const [twitchRows, repRows, checkinRows, parkingRows, tier3Rows] = await Promise.all([
    sql`SELECT COUNT(*) as cnt, SUM(CASE WHEN acted = false THEN 1 ELSE 0 END) as resisted FROM twitch_logs`,
    sql`SELECT COUNT(*) as cnt FROM rep_completions`,
    sql`SELECT created_at::date as d FROM felt_checkins ORDER BY created_at DESC`,
    sql`SELECT COUNT(*) as cnt FROM parking_lot WHERE decision = 'let_go'`,
    sql`SELECT COUNT(*) as cnt FROM rep_completions rc JOIN rep_cards c ON c.id = rc.card_id WHERE c.tier = 3`,
  ]);

  const totalActed    = Number(twitchRows[0].cnt) - Number(twitchRows[0].resisted ?? 0);
  const totalResisted = Number(twitchRows[0].resisted ?? 0);

  // Streak: consecutive days with a checkin
  let checkinsStreak = 0;
  const checkinDays  = checkinRows.map((r: Record<string, unknown>) => (r.d as Date).toISOString().slice(0, 10));
  for (let i = 0; i < 365; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    if (checkinDays.includes(d)) checkinsStreak++;
    else break;
  }

  return {
    totalResisted,
    totalActed,
    completedReps:      Number(repRows[0].cnt),
    checkinsStreak,
    hasCompletedTier3:  Number(tier3Rows[0].cnt) > 0,
    parkingLetGoCount:  Number(parkingRows[0].cnt),
  };
}
