import { NextRequest, NextResponse } from "next/server";
import { listPartners, createPartner, updatePartner, deletePartner, rotateToken, type PartnerRole } from "@/lib/partners";
import { putMedia } from "@/lib/media";

export const dynamic = "force-dynamic";

const ROLES: PartnerRole[] = ["quizmaster", "accountability"];

export async function GET() {
  try {
    return NextResponse.json({ partners: await listPartners() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Couldn't load your study partners" },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, role, photo, seeScores } = await req.json();
    const clean = typeof name === "string" ? name.trim() : "";
    if (!clean) return NextResponse.json({ error: "Give them a name" }, { status: 400 });
    if (role && !ROLES.includes(role)) {
      return NextResponse.json({ error: "Unknown role" }, { status: 400 });
    }

    // Photos go straight to the media table — never into a JSON blob.
    let mediaId: string | null = null;
    if (typeof photo === "string" && photo.startsWith("data:image/")) {
      mediaId = await putMedia(`p-${Math.random().toString(36).slice(2, 12)}`, photo);
    }

    const partner = await createPartner({
      name: clean.slice(0, 60),
      role: (role as PartnerRole) ?? "quizmaster",
      mediaId,
      seeScores: Boolean(seeScores),
    });
    return NextResponse.json({ partner });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't add them" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, photo, rotate, ...fields } = await req.json();
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (rotate) {
      const token = await rotateToken(id);
      return NextResponse.json({ ok: true, token });
    }

    if (typeof photo === "string" && photo.startsWith("data:image/")) {
      const mediaId = await putMedia(`p-${Math.random().toString(36).slice(2, 12)}`, photo);
      if (mediaId) await updatePartner(id, { mediaId });
    }

    const allowed: Record<string, unknown> = {};
    if (typeof fields.name === "string" && fields.name.trim()) allowed.name = fields.name.trim().slice(0, 60);
    if (ROLES.includes(fields.role)) allowed.role = fields.role;
    if (typeof fields.seeScores === "boolean") allowed.seeScores = fields.seeScores;
    if (typeof fields.active === "boolean") allowed.active = fields.active;
    if (Object.keys(allowed).length) await updatePartner(id, allowed);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't update them" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  try {
    await deletePartner(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't remove them" }, { status: 500 });
  }
}
