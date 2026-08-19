import { NextRequest, NextResponse } from "next/server";
import { fetchQuestions, bankStats, listBankLectures } from "@/lib/qbank";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  try {
    if (p.get("meta") === "1") {
      const [stats, lectures] = await Promise.all([bankStats(), listBankLectures()]);
      return NextResponse.json({ ...stats, lectures });
    }
    const questions = await fetchQuestions({
      course: p.get("course") ?? undefined,
      lectureId: p.get("lecture") ?? undefined,
      format: p.get("format") ?? undefined,
      missedOnly: p.get("missed") === "1",
      limit: Number(p.get("limit") ?? "30"),
    });
    return NextResponse.json({ questions });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
