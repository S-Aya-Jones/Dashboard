// Getting a slide deck to the server.
//
// Two routes, because the two formats are different problems. A PDF has to
// reach Claude intact — the figures are half of why the deck is worth having —
// so it is uploaded whole, in pieces, and read on the server. A .pptx is a zip
// of XML, which the browser can open itself, so its text is extracted here and
// no file is uploaded at all.

const PART_BYTES = 2_000_000; // base64 chars per request, well under Vercel's 4.5MB body cap

export type SlideProgress = (stage: "reading" | "uploading" | "digesting", pct: number) => void;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(binary);
}

/** Pull the visible text out of a .pptx without uploading it. */
async function pptxText(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const slideFiles = Object.keys(zip.files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)![1]);
      const nb = Number(b.match(/slide(\d+)\.xml$/)![1]);
      return na - nb;
    });

  if (!slideFiles.length) throw new Error("that .pptx has no slides in it");

  const out: string[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async("string");
    // <a:t> holds every run of visible text; paragraph breaks separate lines.
    const runs = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)).map(m =>
      m[1]
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .trim(),
    ).filter(Boolean);

    out.push(`SLIDE ${i + 1}: ${runs[0] ?? "(no title)"}`);
    for (const r of runs.slice(1)) out.push(`- ${r}`);
    out.push("");
  }

  const text = out.join("\n").trim();
  if (text.replace(/SLIDE \d+: \(no title\)/g, "").trim().length < 40) {
    throw new Error("no readable text in that .pptx — if the slides are images, export it as a PDF instead");
  }
  return text;
}

/**
 * Readable text out of an HTML file, without uploading it.
 *
 * Course material turns up as HTML more often than as a deck — a Blackboard
 * page saved to disk, a handout exported from Word, a "save page as". It is
 * already text, so the browser parses it and sends only what it says.
 *
 * Headings become slide markers so the lesson can still cite "which part of the
 * deck this came from"; without them the whole file collapses into one wall.
 */
async function htmlText(file: File): Promise<string> {
  const raw = await file.text();
  const doc = new DOMParser().parseFromString(raw, "text/html");

  // Navigation, scripts and styling are not the material.
  doc.querySelectorAll("script, style, nav, header, footer, noscript, svg").forEach(n => n.remove());

  const out: string[] = [];
  let section = 0;
  const seen = new Set<Node>();

  const blocks = doc.body?.querySelectorAll("h1, h2, h3, h4, p, li, td, th, pre, blockquote") ?? [];
  blocks.forEach(el => {
    // A <li> inside a <td> would otherwise be emitted twice.
    if (Array.from(seen).some(a => a.contains(el))) return;
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) return;

    if (/^H[1-4]$/.test(el.tagName)) {
      section += 1;
      out.push("", `SLIDE ${section}: ${text}`);
      seen.add(el);
      return;
    }
    if (!out.length) out.push(`SLIDE 1: ${stripExtensionLocal(file.name)}`);
    out.push(`- ${text}`);
    seen.add(el);
  });

  const text = out.join("\n").trim();
  if (text.replace(/SLIDE \d+:.*/g, "").trim().length < 40) {
    throw new Error("that HTML file has almost no readable text in it");
  }
  return text;
}

function stripExtensionLocal(name: string): string {
  return name.replace(/\.[A-Za-z0-9]{1,5}$/, "");
}

/**
 * Attach several decks to one lecture, in order. A single recording routinely
 * covers two lectures and therefore two decks.
 */
export async function uploadAllSlides(
  lectureId: string,
  files: File[],
  onProgress?: SlideProgress,
): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    await uploadSlides(lectureId, files[i], onProgress, i > 0);
  }
}

/**
 * Attach a deck to a lecture. Resolves once the slides are stored as text and
 * ready to be used by note generation.
 */
export async function uploadSlides(
  lectureId: string,
  file: File,
  onProgress?: SlideProgress,
  append = false,
): Promise<void> {
  const isPdf  = /\.pdf$/i.test(file.name)  || file.type === "application/pdf";
  const isPptx = /\.pptx$/i.test(file.name) || file.type.includes("presentationml");
  const isText = /\.(html?|txt|md|markdown)$/i.test(file.name)
    || file.type === "text/html" || file.type === "text/plain" || file.type === "text/markdown";

  if (!isPdf && !isPptx && !isText) {
    throw new Error("Slides can be a PDF, a .pptx, or an HTML/text file. In PowerPoint or Google Slides: File → Download → PDF.");
  }

  // HTML and plain text are already words — parsed here, nothing uploaded.
  if (isText) {
    onProgress?.("reading", 0.3);
    const isHtml = /\.html?$/i.test(file.name) || file.type === "text/html";
    const text = isHtml ? await htmlText(file) : (await file.text()).trim();
    if (text.length < 40) throw new Error("that file has almost no readable text in it");

    onProgress?.("uploading", 0.8);
    const res = await fetch(`/api/lectures/${lectureId}/slides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, text: text.slice(0, 40000), append }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "couldn't save that file");
    onProgress?.("digesting", 1);
    return;
  }

  if (isPptx) {
    onProgress?.("reading", 0.3);
    const text = await pptxText(file);
    onProgress?.("uploading", 0.8);
    const res = await fetch(`/api/lectures/${lectureId}/slides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, text, append }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "couldn't save those slides");
    onProgress?.("digesting", 1);
    return;
  }

  onProgress?.("reading", 0.15);
  const base64 = toBase64(await file.arrayBuffer());

  const parts = Math.ceil(base64.length / PART_BYTES);
  for (let i = 0; i < parts; i++) {
    onProgress?.("uploading", 0.15 + (0.65 * i) / parts);
    const res = await fetch(`/api/lectures/${lectureId}/slides/part`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idx: i, data: base64.slice(i * PART_BYTES, (i + 1) * PART_BYTES) }),
    });
    if (!res.ok) {
      throw new Error((await res.json().catch(() => ({}))).error ?? `slide upload failed on piece ${i + 1}`);
    }
  }

  // Read a window of slides at a time. One call for a whole deck overran
  // Vercel's 60s limit and returned an HTML gateway error, which surfaced as an
  // unexplained failure; each window is short enough to finish.
  const MAX_WINDOWS = 15;
  let from = 1;
  for (let w = 0; w < MAX_WINDOWS; w++) {
    onProgress?.("digesting", 0.85 + (0.15 * w) / MAX_WINDOWS);
    const res = await fetch(`/api/lectures/${lectureId}/slides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, from, append }),
    });
    if (!res.ok) {
      // A gateway timeout is HTML, not JSON, so say something true rather than
      // letting an empty parse become a meaningless message.
      const detail = await res.json().catch(() => null);
      throw new Error(
        detail?.error ??
        (res.status === 504
          ? "reading the deck timed out — try a smaller PDF"
          : `the slides server returned ${res.status}`),
      );
    }
    const body = await res.json();
    if (body.done) break;
    from = body.next ?? from + 12;
  }
  onProgress?.("digesting", 1);
}
