import { NextRequest, NextResponse } from "next/server";
import { loadDeck, saveCardState, reviewDays, reviewedToday } from "@/lib/reviewStore";
import { dueQueue, dueCounts, schedule, streakFrom, type Rating } from "@/lib/srs";

export const dynamic = "force-dynamic";

// The day's review queue, and one graded answer at a time.
//
// GET returns what's due plus the counts and the streak, so the home page and
// the session read the same numbers from one call rather than disagreeing.

export async function GET(req: NextRequest) {
  try {
    const limit = Number(req.nextUrl.searchParams.get("newLimit") ?? 20);
    const deck = await loadDeck();
    const queue = dueQueue(deck, Number.isFinite(limit) ? limit : 20);
    const [days, today] = await Promise.all([reviewDays(), reviewedToday()]);

    return NextResponse.json({
      counts: dueCounts(deck),
      deckSize: deck.length,
      streak: streakFrom(days),
      reviewedToday: today,
      // The whole due queue, so grading never waits on a round trip.
      queue,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id, rating, card } = await req.json();
    if (typeof id !== "string" || typeof rating !== "number" || rating < 0 || rating > 3) {
      return NextResponse.json({ error: "id and a rating of 0–3 are required" }, { status: 400 });
    }
    if (!card) return NextResponse.json({ error: "card state required" }, { status: 400 });

    // Scheduled from the card the client is holding, so a stale reload can't
    // rewind a card that has already moved on within the session.
    const next = schedule(card, rating as Rating);
    await saveCardState(id, next, rating);
    return NextResponse.json({ ok: true, next });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
