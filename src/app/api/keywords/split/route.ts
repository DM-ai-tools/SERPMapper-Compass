import { NextRequest, NextResponse } from "next/server";
import { splitServiceKeywords } from "@/lib/keyword-intelligence";

export async function POST(req: NextRequest) {
  let body: { raw?: unknown; max_keywords?: unknown };
  try {
    body = (await req.json()) as { raw?: unknown; max_keywords?: unknown };
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const raw = typeof body.raw === "string" ? body.raw.trim() : "";
  if (!raw) {
    return NextResponse.json({ keywords: [], source: "fallback" as const });
  }

  const requestedMax =
    typeof body.max_keywords === "number" && Number.isFinite(body.max_keywords)
      ? Math.floor(body.max_keywords)
      : 10;
  const maxKeywords = Math.max(1, Math.min(10, requestedMax));

  const result = await splitServiceKeywords(raw, maxKeywords);
  return NextResponse.json(result);
}
