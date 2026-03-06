import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey || apiKey === "placeholder") {
      return NextResponse.json(
        { error: "Pexels API key not configured. Add PEXELS_API_KEY to your environment variables at pexels.com/api" },
        { status: 503 }
      );
    }

    const params = new URLSearchParams({ query, per_page: "40" });
    const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Pexels API error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const photos = (data.photos || []).map((p: any) => ({
      url: p.src.original,
      thumb: p.src.medium,
      alt: p.alt || p.photographer,
      photographer: p.photographer,
      pexelsId: p.id,
    }));

    return NextResponse.json({ photos });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
