import { toBase64, pptxText, htmlText } from "@/lib/slidesUpload";

// Getting a classmate's study guide into the app.
//
// Same three problems as a lecture deck, so it reuses the same parsers: HTML
// and .pptx are opened in the browser and only their text is sent; a PDF has to
// reach Claude intact and so is uploaded in pieces. What differs is where it
// lands — course material is not tied to a lecture she recorded.

const PART_BYTES = 2_000_000;

export interface MaterialInput {
  course: string;
  title: string;
  source: string;
  kind: "notes" | "questions" | "guide" | "other";
}

export type MaterialProgress = (stage: "reading" | "uploading" | "digesting") => void;

function newKey(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function uploadMaterial(
  file: File,
  meta: MaterialInput,
  companions: File[] = [],
  onProgress?: MaterialProgress,
): Promise<void> {
  const isPdf  = /\.pdf$/i.test(file.name)  || file.type === "application/pdf";
  const isPptx = /\.pptx$/i.test(file.name) || file.type.includes("presentationml");
  const isHtml = /\.html?$/i.test(file.name) || file.type === "text/html";
  const isText = /\.(txt|md|markdown)$/i.test(file.name) || file.type === "text/plain";

  if (!isPdf && !isPptx && !isHtml && !isText) {
    throw new Error("That needs to be a PDF, .pptx, HTML or text file.");
  }

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/material", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...meta, ...payload }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      throw new Error(d?.error ?? `couldn't save that (${res.status})`);
    }
  };

  if (isHtml) {
    onProgress?.("reading");
    const { text, images } = await htmlText(file, companions);
    onProgress?.(images.length ? "digesting" : "uploading");
    await post({ text, images });
    return;
  }

  if (isPptx) {
    onProgress?.("reading");
    await post({ text: await pptxText(file) });
    return;
  }

  if (isText) {
    onProgress?.("reading");
    const text = (await file.text()).trim();
    if (text.length < 40) throw new Error("there's almost nothing in that file");
    await post({ text });
    return;
  }

  // PDF: staged in pieces, then read on the server.
  onProgress?.("reading");
  const base64 = toBase64(await file.arrayBuffer());
  const key = newKey();
  const parts = Math.ceil(base64.length / PART_BYTES);

  for (let i = 0; i < parts; i++) {
    onProgress?.("uploading");
    const res = await fetch("/api/material/part", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, idx: i, data: base64.slice(i * PART_BYTES, (i + 1) * PART_BYTES) }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      throw new Error(d?.error ?? `upload failed on piece ${i + 1}`);
    }
  }

  onProgress?.("digesting");
  await post({ partKey: key });
}
