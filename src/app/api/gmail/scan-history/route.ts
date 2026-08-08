import { NextResponse } from "next/server";
import {
  getFreshGmailToken,
  fetchGmailMetadataPage,
  fetchSingleEmail,
  extractEventsFromEmail,
  upsertEmailEvents,
  categorizeEmail,
} from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Broad net — anything that might reference a date or scheduled event
function isDateRelevant(subject: string, sender: string, snippet: string): boolean {
  const text = `${subject} ${sender} ${snippet}`.toLowerCase();
  return /appointment|therapy|session|scheduled|see you|bill due|payment due|amount due|autopay|deadline|due date|due by|submit by|assignment due|quiz|exam|gym|workout|fitness|class|lecture|reservation|booking|confirmed|reminder|starting|begins|check.?in|your visit|your order|delivery|pickup|meeting|interview|confirmation/.test(text);
}

export async function POST() {
  const token = await getFreshGmailToken();
  if (!token) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  // Build date string 12 months ago in YYYY/MM/DD format
  const twelveMonthsAgo = new Date(Date.now() - 365 * 86400000);
  const after = `${twelveMonthsAgo.getFullYear()}/${String(twelveMonthsAgo.getMonth() + 1).padStart(2, "0")}/${String(twelveMonthsAgo.getDate()).padStart(2, "0")}`;

  // Broad query — cast a wide net for any scheduled/time-based emails
  const query = `in:inbox after:${after} (appointment OR therapy OR session OR scheduled OR "bill due" OR "payment due" OR "amount due" OR autopay OR deadline OR "due date" OR "due by" OR "assignment due" OR quiz OR exam OR gym OR workout OR reservation OR booking OR confirmation OR reminder OR class OR lecture OR meeting)`;

  // Fetch up to 400 IDs in four pages
  const page1 = await fetchGmailMetadataPage(token, query, 100);
  const page2 = page1.nextPageToken
    ? await fetchGmailMetadataPage(token, query, 100, page1.nextPageToken)
    : { ids: [], nextPageToken: undefined };
  const page3 = page2.nextPageToken
    ? await fetchGmailMetadataPage(token, query, 100, page2.nextPageToken)
    : { ids: [], nextPageToken: undefined };
  const page4 = page3.nextPageToken
    ? await fetchGmailMetadataPage(token, query, 100, page3.nextPageToken)
    : { ids: [] };

  const allIds = Array.from(new Set([...page1.ids, ...page2.ids, ...page3.ids, ...page4.ids]));

  if (!allIds.length) {
    return NextResponse.json({ scanned: 0, eventsFound: 0, future: 0, past: 0 });
  }

  // Fetch metadata for each to filter before full-body fetch
  const metaBatches: string[][] = [];
  for (let i = 0; i < allIds.length; i += 20) metaBatches.push(allIds.slice(i, i + 20));

  const toFullFetch: string[] = [];
  for (const batch of metaBatches) {
    await Promise.all(batch.map(async id => {
      try {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;
        const msg = await res.json();
        const headers = msg.payload?.headers ?? [];
        const get = (name: string) => (headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "") as string;
        const subject = get("subject");
        const from = get("from");
        const snippet = msg.snippet as string ?? "";
        if (isDateRelevant(subject, from, snippet)) {
          toFullFetch.push(id);
        }
      } catch { /* skip */ }
    }));
  }

  // Full fetch in batches of 10 — up to 100 emails (rate limit friendly)
  const allEvents = [];
  const fullBatches: string[][] = [];
  for (let i = 0; i < Math.min(toFullFetch.length, 100); i += 10) {
    fullBatches.push(toFullFetch.slice(i, i + 10));
  }

  for (const batch of fullBatches) {
    const emails = await Promise.all(batch.map(id => fetchSingleEmail(token, id)));
    for (const email of emails) {
      if (!email) continue;
      const cat = categorizeEmail(email);
      if (cat === "spam") continue;
      const events = extractEventsFromEmail(
        email.id,
        email.subject,
        email.senderName,
        email.senderEmail,
        email.bodyPreview,
        email.bodyContent,
      );
      allEvents.push(...events);
    }
  }

  await upsertEmailEvents(allEvents);

  const now = new Date();
  const future = allEvents.filter(e => new Date(e.eventDate) >= now).length;
  const past   = allEvents.filter(e => new Date(e.eventDate) < now).length;

  return NextResponse.json({
    scanned:     toFullFetch.length,
    eventsFound: allEvents.length,
    future,
    past,
  });
}
