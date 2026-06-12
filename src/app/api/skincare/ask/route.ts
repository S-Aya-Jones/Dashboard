import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { question, analysis } = await req.json();
  if (!question?.trim()) return NextResponse.json({ error: "No question provided" }, { status: 400 });
  if (!analysis) return NextResponse.json({ error: "No analysis provided" }, { status: 400 });

  const context = [
    `Overall Rating: ${analysis.overallRating}/10`,
    `Skin Score: ${analysis.skinScore}/100`,
    `Apparent Age: ${analysis.apparentAge?.estimated} (${analysis.apparentAge?.note})`,
    `Face Shape: ${analysis.featureAnalysis?.faceShape}`,
    `Summary: ${analysis.skinAssessment?.summary}`,
    `Key concerns: ${analysis.skinAssessment?.concerns?.join(", ")}`,
    `Strengths: ${analysis.skinAssessment?.strengths?.join(", ")}`,
    `Feature areas: ${analysis.featureAnalysis?.areas?.join(", ")}`,
    `Honest assessment: ${analysis.roadmap?.honestAssessment}`,
    `Current potential: ${analysis.roadmap?.currentRating}/10 to ${analysis.roadmap?.potentialRating}/10`,
    analysis.roadmap?.absoluteCeiling ? `Surgical ceiling: ${analysis.roadmap.absoluteCeiling}/10` : "",
    analysis.surgicalConsiderations?.highYield?.length
      ? `High-yield procedures: ${analysis.surgicalConsiderations.highYield.map((p: { name: string }) => p.name).join(", ")}`
      : "",
  ].filter(Boolean).join("\n");

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `You are a brutally honest aesthetic consultant, dermatologist, and beauty analyst. You previously analyzed someone's appearance with these results:

${context}

Answer their follow-up question directly and specifically based on the analysis. Be honest, practical, and actionable. No fluff.

Question: ${question}`,
      }],
    });

    const answer = msg.content[0].type === "text" ? msg.content[0].text : "Unable to answer";
    return NextResponse.json({ answer });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
