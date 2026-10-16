import { NextResponse } from "next/server";
import { firstText } from "@/lib/aiError";
import Anthropic from "@anthropic-ai/sdk";
import { getStoredEmails } from "@/lib/gmail";
import { upsertObligation } from "@/lib/obligations";
import { recordUpdate, UpdateKind } from "@/lib/schoolUpdates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic();

// The old system keyword-matched subject lines for "due" and "deadline", which
// is why "New content in Physiology" became an event and real assignments were
// missed. This actually reads the message and decides whether an obligation
// exists — and if the email doesn't contain one, it says so.

const SYSTEM = `You read a graduate student's course email and extract only REAL obligations — things she must DO by a date.

Return ONLY JSON (no fences):
{
  "obligations": [ { "kind": "assignment|exam|appointment|admin", "title": "short specific title including the course", "detail": "what she actually has to do, one sentence", "dueAt": "YYYY-MM-DDTHH:MM:00", "confidence": "high|medium|low" } ],
  "updates": [ { "kind": "change|action|opportunity|warning", "headline": "what changed, under 90 characters", "detail": "why it matters to her, one sentence", "course": "course name or null" } ]
}

Extract nothing — return an empty array — for:
- "New content posted", "grade posted", announcements, syllabus updates
- Newsletters, marketing, campus notices with no action for her
- Anything where SHE has no task and no date

Extract when there IS a task with a date:
- An assignment, problem set, paper, lab report, discussion post, or submission
- A quiz or exam with a date
- Something requiring her reply, signature, form, or attendance by a date
- Financial aid or registration steps with a deadline

UPDATES are the other half, and matter as much. These are things that change how her week works but carry no deadline she can be reminded of. Extract an update when the email says any of:
- Something has MOVED or CHANGED: a room, a link, a platform, a time, a policy, who to contact
- Access will be WITHDRAWN or is CONDITIONAL: "this stops after week 3", "you cannot sit a quiz unless registered"
- A prerequisite she would not otherwise know: "the course won't appear until you enrol", "you must submit both X and Y"
- An opportunity with money or standing attached: a scholarship, an award, a research place

Do not create an update for ordinary announcements, posted grades, or anything already captured as an obligation.
Write the headline as the fact itself — "Zoom links are on Blackboard now, no longer emailed" — not "email about Zoom links".

Rules:
- dueAt must be an actual date from the email. If no date is stated or clearly implied, do not extract it.
- Assume the current year unless the email says otherwise. If only a date is given with no time, use 23:59.
- Relative dates count as stated: "this week" means the coming Friday, "by week 3" means the Friday of the third week of term. Resolve them and mark confidence "low".
- Title must name the course when identifiable, e.g. "Biochemistry — Problem Set 2".
- confidence "low" if you are inferring the date rather than reading it.`;

function parse(raw: string) {
  const c = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try { return JSON.parse(c); } catch { /* fall through */ }
  const m = c.match(/\{[\s\S]*\}/);
  if (!m) return { obligations: [] };
  try { return JSON.parse(m[0]); } catch { return { obligations: [] }; }
}

export async function POST() {
  try {
    const emails = await getStoredEmails(40, 0);
    // Only school + action mail from the last 30 days is worth the tokens
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    const candidates = emails.filter(
      e => e.receivedAt >= cutoff && (e.category === "school" || e.category === "action"),
    ).slice(0, 18);

    if (!candidates.length) {
      return NextResponse.json({ ok: true, scanned: 0, found: 0, obligations: [] });
    }

    const today = new Date().toISOString().slice(0, 10);
    const payload = candidates.map(e => ({
      id: e.id,
      subject: e.subject,
      from: e.senderName || e.senderEmail,
      received: e.receivedAt.slice(0, 10),
      body: (e.bodyContent || e.bodyPreview || "").slice(0, 2500),
    }));

    const found: Array<Record<string, unknown>> = [];
    const updates: Array<Record<string, unknown>> = [];

    // Small groups keep each call fast and let one bad email fail alone
    for (let i = 0; i < payload.length; i += 6) {
      const group = payload.slice(i, i + 6);
      try {
        const msg = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2000,
          system: `${SYSTEM}\n\nToday's date is ${today}.`,
          messages: [{
            role: "user",
            content: group.map(g =>
              `--- EMAIL id=${g.id}\nFrom: ${g.from}\nReceived: ${g.received}\nSubject: ${g.subject}\n\n${g.body}`
            ).join("\n\n"),
          }],
        });
        const raw = firstText(msg);
        const parsed = parse(raw);
        for (const o of (parsed.obligations ?? [])) {
          if (!o?.title || !o?.dueAt) continue;
          const due = new Date(o.dueAt);
          if (isNaN(due.getTime())) continue;
          // Ignore anything already well past — this is a forward-looking list
          if (due.getTime() < Date.now() - 2 * 86400000) continue;

          const leadDays = o.kind === "exam" ? [10, 7, 3, 1, 0] : [7, 3, 1, 0];
          await upsertObligation({
            source: "school",
            kind: o.kind === "exam" ? "exam" : o.kind === "appointment" ? "appointment" : "assignment",
            title: String(o.title),
            detail: String(o.detail ?? ""),
            dueAt: due.toISOString(),
            leadDays,
            externalId: `mail:${String(o.title).slice(0, 60)}:${due.toISOString().slice(0, 10)}`,
          });
          found.push(o);
        }

        for (const u of (parsed.updates ?? [])) {
          if (!u?.headline) continue;
          const emailId = group.find(g => g.subject && u.course !== undefined)?.id ?? group[0].id;
          await recordUpdate({
            emailId,
            kind: (["change", "action", "opportunity", "warning"].includes(u.kind) ? u.kind : "change") as UpdateKind,
            headline: String(u.headline).slice(0, 200),
            detail: String(u.detail ?? "").slice(0, 400),
            course: u.course ? String(u.course).slice(0, 60) : null,
          });
          updates.push(u);
        }
      } catch { /* skip this group, keep the rest */ }
    }

    return NextResponse.json({
      ok: true,
      scanned: candidates.length,
      found: found.length,
      obligations: found,
      updates: updates.length,
      updateList: updates,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
