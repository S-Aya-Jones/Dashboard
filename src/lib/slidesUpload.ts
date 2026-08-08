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
 * Attach a deck to a lecture. Resolves once the slides are stored as text and
 * ready to be used by note generation.
 */
export async function uploadSlides(
  lectureId: string,
  file: File,
  onProgress?: SlideProgress,
): Promise<void> {
  const isPdf  = /\.pdf$/i.test(file.name)  || file.type === "application/pdf";
  const isPptx = /\.pptx$/i.test(file.name) || file.type.includes("presentationml");

  if (!isPdf && !isPptx) {
    throw new Error("Slides need to be a PDF or a .pptx. In PowerPoint or Google Slides: File → Download → PDF.");
  }

  if (isPptx) {
    onProgress?.("reading", 0.3);
    const text = await pptxText(file);
    onProgress?.("uploading", 0.8);
    const res = await fetch(`/api/lectures/${lectureId}/slides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, text }),
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

  onProgress?.("digesting", 0.85);
  const res = await fetch(`/api/lectures/${lectureId}/slides`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "couldn't read those slides");
  onProgress?.("digesting", 1);
}
