import { NextResponse } from "next/server";
import { loadData, saveData } from "@/lib/db";
import { HealthDailySnapshot, HealthWorkout } from "@/types/dashboard";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Diagnostic: GET /api/health/import returns what's stored in DB
export async function GET() {
  try {
    const data = await loadData("aya");
    const h = data.health;
    return NextResponse.json({
      hasHealth: !!h,
      lastImportAt: h?.lastImportAt ?? null,
      dailyDates: Object.keys(h?.daily ?? {}).sort(),
      workoutCount: h?.workouts?.length ?? 0,
      sampleWorkout: h?.workouts?.[0] ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function parseDate(str: string): string {
  return typeof str === "string" ? str.slice(0, 10) : "";
}

function workoutId(type: string, start: string): string {
  const raw = `${type}|${start}`;
  return "ah_" + Buffer.from(raw).toString("base64url").slice(0, 24);
}

export async function POST(req: Request) {
  const secret = process.env.HEALTH_IMPORT_SECRET?.trim();
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Support both { data: { metrics, workouts } } and { metrics, workouts }
  const metricsArr: unknown[] = (body?.data as Record<string, unknown>)?.metrics as unknown[] ?? (body?.metrics as unknown[]) ?? [];
  const rawWorkouts: unknown[] = (body?.data as Record<string, unknown>)?.workouts as unknown[] ?? (body?.workouts as unknown[]) ?? [];

  // ── Parse metrics → daily snapshots ──────────────────────────────────────
  const dailyPatch: { [date: string]: HealthDailySnapshot } = {};

  function ensureDay(date: string): HealthDailySnapshot {
    if (!dailyPatch[date]) dailyPatch[date] = {};
    return dailyPatch[date];
  }

  for (const metric of metricsArr) {
    const m = metric as Record<string, unknown>;
    const name = String(m.name ?? "");
    const points: unknown[] = (m.data as unknown[]) ?? [];

    for (const pt of points) {
      const p = pt as Record<string, unknown>;
      const date = parseDate(String(p.date ?? ""));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const qty = typeof p.qty === "number" ? p.qty : null;
      if (qty === null) continue;

      const snap = ensureDay(date);

      switch (name) {
        case "step_count":
          snap.steps = (snap.steps ?? 0) + Math.round(qty);
          break;
        case "active_energy":
        case "active_energy_burned":
          snap.activeEnergy = (snap.activeEnergy ?? 0) + Math.round(qty);
          break;
        case "apple_exercise_time":
        case "exercise_time":
          snap.exerciseMinutes = (snap.exerciseMinutes ?? 0) + Math.round(qty);
          break;
        case "resting_heart_rate":
          snap.restingHR = Math.round(qty);
          break;
        case "body_mass":
        case "weight_body_mass":
          snap.weight = Math.round(qty * 10) / 10;
          break;
        case "mindful_session":
        case "mindful_minutes":
          snap.mindfulMinutes = (snap.mindfulMinutes ?? 0) + Math.round(qty);
          break;
        case "sleep_analysis": {
          const val = String(p.value ?? "");
          if (["asleep", "core", "deep", "rem", "inBed"].includes(val)) {
            snap.sleepHours = Math.round(((snap.sleepHours ?? 0) + qty) * 100) / 100;
          }
          break;
        }
        // Unknown metrics are silently skipped
      }
    }
  }

  // ── Parse workouts ────────────────────────────────────────────────────────
  const parsedWorkouts: HealthWorkout[] = [];

  for (const raw of rawWorkouts) {
    const w = raw as Record<string, unknown>;
    const startStr = String(w.start ?? w.startDate ?? "");
    if (!startStr) continue;

    let startedAt: string;
    try {
      startedAt = new Date(startStr).toISOString();
    } catch {
      continue;
    }

    const type = String(w.name ?? w.workoutActivityType ?? "Workout");
    const durationMin = Math.round(typeof w.duration === "number" ? w.duration : 0);

    const calObj = (w.activeEnergyBurned ?? w.totalEnergyBurned ?? w.activeEnergy) as Record<string, unknown> | null;
    const calories = typeof calObj?.qty === "number" ? Math.round(calObj.qty) : undefined;

    const distObj = (w.totalDistance ?? w.distance) as Record<string, unknown> | null;
    const distance = typeof distObj?.qty === "number" ? Math.round(distObj.qty * 100) / 100 : undefined;

    parsedWorkouts.push({
      id: workoutId(type, startStr),
      type,
      startedAt,
      durationMin,
      ...(calories !== undefined ? { calories } : {}),
      ...(distance !== undefined ? { distance } : {}),
      source: "apple_health",
    });
  }

  // ── Merge into existing data ──────────────────────────────────────────────
  const existing = await loadData("aya");
  const prev = existing.health ?? { lastImportAt: "", daily: {}, workouts: [] };

  const mergedDaily = { ...prev.daily };
  for (const [date, snap] of Object.entries(dailyPatch)) {
    mergedDaily[date] = { ...prev.daily[date], ...snap };
  }

  const byId = new Map(prev.workouts.map((w) => [w.id, w]));
  for (const w of parsedWorkouts) byId.set(w.id, w);
  const mergedWorkouts = Array.from(byId.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );

  await saveData({
    ...existing,
    health: {
      lastImportAt: new Date().toISOString(),
      daily: mergedDaily,
      workouts: mergedWorkouts,
    },
  });

  return NextResponse.json({
    status: "ok",
    imported: {
      metrics: Object.keys(dailyPatch).length,
      workouts: parsedWorkouts.length,
    },
  });
}
