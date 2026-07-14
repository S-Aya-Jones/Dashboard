import { NextRequest, NextResponse } from "next/server";
import { getTodayDraw, drawCard, redrawCard, getRepCards, getRepCompletions } from "@/lib/felt-safety-db";

export async function GET() {
  const completions = await getRepCompletions();
  const todayDraw   = await getTodayDraw();

  if (todayDraw) {
    const cards = await getRepCards();
    const card  = cards.find(c => c.id === todayDraw.cardId);
    return NextResponse.json({ card: card ?? null, redrawn: todayDraw.redrawn, alreadyDrawn: true });
  }

  const card = await drawCard(completions.length);
  return NextResponse.json({ card, redrawn: false, alreadyDrawn: false });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body.action === "redraw") {
    const completions = await getRepCompletions();
    const card = await redrawCard(completions.length);
    if (!card) return NextResponse.json({ error: "Already redrawn today" }, { status: 400 });
    return NextResponse.json({ card, redrawn: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
