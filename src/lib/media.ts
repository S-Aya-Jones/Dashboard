import { neonClient } from "@/lib/neon";

// Base64 photos used to live inside the single dashboard JSON blob, which is
// read in full on every page load and written in full on every change. One
// phone photo is a couple of megabytes as base64, so a handful of body scans
// meant every navigation downloaded all of them and every checkbox tick
// uploaded them back. That is what exhausted the database's transfer quota.
//
// Photos now live in their own table and the blob keeps only an id. They are
// fetched by URL, which means the browser caches them and they are never sent
// again on a save.

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neonClient(url);
}

let ready = false;
async function ensureMedia() {
  // CREATE TABLE IF NOT EXISTS on every request is itself traffic. Once per
  // process is enough.
  if (ready) return;
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS media (
      id         TEXT PRIMARY KEY,
      mime       TEXT NOT NULL DEFAULT 'image/jpeg',
      data       TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  ready = true;
}

/** Split a data URL into its mime type and raw base64. */
function parseDataUrl(v: string): { mime: string; base64: string } | null {
  const m = v.match(/^data:([^;,]+);base64,([\s\S]+)$/);
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

/**
 * Store a photo and return its id. Returns null if it can't be stored, so the
 * caller can keep the photo inline rather than losing it.
 */
export async function putMedia(id: string, dataUrl: string): Promise<string | null> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  try {
    await ensureMedia();
    const sql = db();
    await sql`
      INSERT INTO media (id, mime, data) VALUES (${id}, ${parsed.mime}, ${parsed.base64})
      ON CONFLICT (id) DO NOTHING
    `;
    return id;
  } catch {
    return null;
  }
}

export async function getMedia(id: string): Promise<{ mime: string; buffer: Buffer } | null> {
  try {
    await ensureMedia();
    const sql = db();
    const rows = await sql`SELECT mime, data FROM media WHERE id = ${id}`;
    if (!rows.length) return null;
    return {
      mime: String(rows[0].mime),
      buffer: Buffer.from(String(rows[0].data), "base64"),
    };
  } catch {
    return null;
  }
}

interface Photoish { id?: string; photoData?: string; mediaId?: string }

/**
 * Move any inline base64 out of a photo list and into the media table.
 * Anything that fails to store keeps its photoData so nothing is ever lost.
 */
export async function externalisePhotos<T extends Photoish>(photos: T[] | undefined): Promise<T[] | undefined> {
  if (!photos?.length) return photos;
  return Promise.all(
    photos.map(async (p) => {
      if (!p.photoData || p.mediaId) return p;
      const id = p.id ?? `m-${Math.random().toString(36).slice(2, 12)}`;
      const stored = await putMedia(id, p.photoData);
      if (!stored) return p;
      const { photoData, ...rest } = p;
      void photoData;
      return { ...rest, mediaId: stored } as T;
    })
  );
}

/** The URL to render a photo from, whichever form it is still in. */
export function photoSrc(p: { photoData?: string; mediaId?: string }): string {
  return p.mediaId ? `/api/media/${p.mediaId}` : p.photoData ?? "";
}
