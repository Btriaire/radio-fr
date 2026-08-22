import { NextRequest, NextResponse } from "next/server";

// Server-side proxy for Apple's iTunes APIs (search / lookup / RSS charts).
// WHY: itunes.apple.com/search and /lookup do NOT send CORS headers, so calling
// them directly from the browser is blocked → podcasts couldn't resolve their
// feedUrl → episode lists came up empty ("Impossible de charger les épisodes")
// → nothing to auto-chain. Routing through our own origin removes CORS entirely
// and works identically in dev and prod.
export const runtime = "edge";

const ALLOWED_HOSTS = new Set(["itunes.apple.com", "rss.applemarketingtools.com"]);

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "missing url" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  // Only proxy Apple's own endpoints — never an open relay.
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: "host not allowed" }, { status: 400 });
  }

  try {
    const res = await fetch(target.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RadioFR/1.0; podcast reader)",
        Accept: "application/json, text/javascript, */*",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
    }
    const body = await res.text();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        // iTunes catalog data is stable enough to cache briefly on the edge.
        "Cache-Control": "s-maxage=600, stale-while-revalidate=120",
      },
    });
  } catch (e: any) {
    const msg = e?.name === "TimeoutError" ? "timeout" : (e?.message ?? "error");
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
