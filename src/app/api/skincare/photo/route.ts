import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

// A photo of the actual bottle, found rather than uploaded.
//
// She asked for pictures without having to take them. Open Beauty Facts is the
// open-data cosmetics database — free, no key, community-photographed product
// shots — so a product she has typed the name of can show its own bottle.
//
// Deliberately not an image search: a generic search would return whatever
// looks like skincare, and a picture of the wrong bottle is worse than no
// picture when the whole point is recognising what to reach for.

const SEARCH = "https://world.openbeautyfacts.org/cgi/search.pl";

interface OBFProduct {
  product_name?: string;
  brands?: string;
  image_front_url?: string;
  image_url?: string;
  code?: string;
}

/** Strip the words that describe a step rather than name a product. */
function queryFor(name: string, brand?: string): string {
  const cleaned = name
    .replace(/\b(step|am|pm|night|morning|daily|weekly|use|apply|then)\b/gi, " ")
    .replace(/[^A-Za-z0-9+ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [brand, cleaned].filter(Boolean).join(" ").slice(0, 80);
}

/**
 * How well a result matches what she typed.
 *
 * Open Beauty Facts will happily return *something* for any query, so an
 * unscored first hit means a random moisturiser shows up under her serum. A
 * result has to share real words with the product name to be used at all.
 */
function score(p: OBFProduct, name: string, brand?: string): number {
  const hay = `${p.product_name ?? ""} ${p.brands ?? ""}`.toLowerCase();
  const words = `${brand ?? ""} ${name}`
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter(w => w.length > 2);
  if (!words.length) return 0;
  const hits = words.filter(w => hay.includes(w)).length;
  return hits / words.length;
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim() ?? "";
  const brand = req.nextUrl.searchParams.get("brand")?.trim() || undefined;
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  try {
    const url = `${SEARCH}?search_terms=${encodeURIComponent(queryFor(name, brand))}` +
      `&search_simple=1&action=process&json=1&page_size=8` +
      `&fields=product_name,brands,image_front_url,image_url,code`;

    const res = await fetch(url, {
      headers: { "User-Agent": "AyaDashboard/1.0 (personal use)" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return NextResponse.json({ image: null, reason: `search returned ${res.status}` });

    const data = await res.json();
    const products: OBFProduct[] = Array.isArray(data.products) ? data.products : [];

    const best = products
      .filter(p => p.image_front_url || p.image_url)
      .map(p => ({ p, s: score(p, name, brand) }))
      .sort((a, b) => b.s - a.s)[0];

    // Below half the words matching, it is a different product that happens to
    // be in the database. Say nothing rather than show the wrong bottle.
    if (!best || best.s < 0.5) {
      return NextResponse.json({ image: null, reason: "no confident match" });
    }

    return NextResponse.json({
      image: best.p.image_front_url ?? best.p.image_url,
      matched: best.p.product_name ?? null,
      brand: best.p.brands ?? null,
      confidence: Math.round(best.s * 100),
      source: "Open Beauty Facts",
    });
  } catch (e) {
    return NextResponse.json({ image: null, reason: String(e).slice(0, 120) });
  }
}
