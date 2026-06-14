import { NextRequest, NextResponse } from "next/server";

// Server-side RSS proxy — no CORS issues, no slow third-party proxy
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "missing url" }, { status: 400 });

  // Basic allow-list: only podcast RSS feeds
  try {
    new URL(url); // validate URL
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RadioFR/1.0; podcast reader)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
      // 8 second timeout
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
    }

    const xml = await res.text();
    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        // Cache 5 minutes on Vercel edge
        "Cache-Control": "s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (e: any) {
    const msg = e?.name === "TimeoutError" ? "timeout" : (e?.message ?? "error");
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
