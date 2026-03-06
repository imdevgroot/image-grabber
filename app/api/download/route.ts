import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

export async function POST(req: NextRequest) {
  try {
    const { urls } = await req.json();
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "urls array required" }, { status: 400 });
    }

    if (urls.length > 100) {
      return NextResponse.json({ error: "Max 100 images per download" }, { status: 400 });
    }

    const zip = new JSZip();
    const usedNames = new Set<string>();

    await Promise.allSettled(
      urls.map(async (url: string) => {
        try {
          const res = await fetch(url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
            },
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) return;

          const buffer = await res.arrayBuffer();
          const contentType = res.headers.get("content-type") || "";

          // Derive filename
          let filename = url.split("/").pop()?.split("?")[0] || "image";
          if (!filename.includes(".")) {
            const ext = contentType.includes("png")
              ? ".png"
              : contentType.includes("gif")
              ? ".gif"
              : contentType.includes("webp")
              ? ".webp"
              : ".jpg";
            filename += ext;
          }

          // Deduplicate filename
          let finalName = filename;
          let counter = 1;
          while (usedNames.has(finalName)) {
            const parts = filename.split(".");
            finalName = parts.slice(0, -1).join(".") + `_${counter}.` + parts.at(-1);
            counter++;
          }
          usedNames.add(finalName);

          zip.file(finalName, buffer);
        } catch {}
      })
    );

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(zipBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="images.zip"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
