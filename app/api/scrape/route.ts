import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch page: ${res.status}` }, { status: 502 });
    }

    const html = await res.text();
    const baseUrl = new URL(url);

    // Extract img src and srcset
    const imgSrcs: string[] = [];
    const srcRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const srcsetRegex = /<img[^>]+srcset=["']([^"']+)["'][^>]*>/gi;
    const ogImageRegex = /content=["']([^"']+\.(jpg|jpeg|png|gif|webp|svg)[^"']*)["']/gi;

    let m: RegExpExecArray | null;

    while ((m = srcRegex.exec(html)) !== null) {
      imgSrcs.push(m[1]);
    }
    while ((m = srcsetRegex.exec(html)) !== null) {
      // srcset has "url 1x, url 2x" format
      const parts = m[1].split(",").map((p) => p.trim().split(/\s+/)[0]);
      imgSrcs.push(...parts);
    }
    while ((m = ogImageRegex.exec(html)) !== null) {
      imgSrcs.push(m[1]);
    }

    // Resolve relative URLs and deduplicate
    const resolved = new Set<string>();
    for (const src of imgSrcs) {
      if (!src || src.startsWith("data:")) continue;
      try {
        const abs = src.startsWith("http") ? src : new URL(src, baseUrl).href;
        resolved.add(abs);
      } catch {}
    }

    const images = Array.from(resolved)
      .filter((u) => /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|$)/i.test(u) || u.includes("image"))
      .slice(0, 200)
      .map((url) => ({ url, thumb: url }));

    return NextResponse.json({ images });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
