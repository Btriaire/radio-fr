import { NextRequest, NextResponse } from "next/server";
import http from "http";
import https from "https";

export const dynamic = "force-dynamic";

interface NowPlayingResult {
  title: string | null;
  artist: string | null;
  raw: string | null;
  station: string | null;
}

// In-memory cache for 8 seconds to prevent hammering radio stream servers
const cache = new Map<string, { data: NowPlayingResult; expiresAt: number }>();
const CACHE_TTL_MS = 8000;

function cleanString(str: string | null | undefined): string | null {
  if (!str) return null;
  let cleaned = str.replace(/\0/g, "").trim();
  cleaned = cleaned.replace(/§\d+.*$/, "").trim();
  cleaned = cleaned.replace(/\[\d+\]$/, "").trim();
  return cleaned || null;
}

function parseStreamTitle(rawTitle: string): { title: string | null; artist: string | null } {
  const cleaned = cleanString(rawTitle);
  if (!cleaned) return { title: null, artist: null };

  const separators = [" - ", " — ", " : ", " | "];
  for (const sep of separators) {
    if (cleaned.includes(sep)) {
      const parts = cleaned.split(sep);
      const artist = cleanString(parts[0]);
      const title = cleanString(parts.slice(1).join(sep));
      if (artist && title) {
        return { artist, title };
      }
    }
  }

  return { title: cleaned, artist: null };
}

function fetchIcyFromStream(streamUrl: string): Promise<NowPlayingResult> {
  return new Promise((resolve) => {
    try {
      const target = new URL(streamUrl);
      const mod = target.protocol === "https:" ? https : http;

      const req = mod.request(
        target,
        {
          headers: {
            "Icy-MetaData": "1",
            "User-Agent": "RadioFR/1.0 (Mozilla/5.0 compatible)",
            Accept: "*/*",
          },
          rejectUnauthorized: false,
        },
        (res) => {
          if (
            (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) &&
            res.headers.location
          ) {
            res.destroy();
            try {
              const redirectUrl = new URL(res.headers.location, target).toString();
              fetchIcyFromStream(redirectUrl).then(resolve);
              return;
            } catch {
              return resolve({ title: null, artist: null, raw: null, station: null });
            }
          }

          const metaintHeader = res.headers["icy-metaint"];
          const icyStationName = cleanString(res.headers["icy-name"] as string | undefined);
          const metaint = metaintHeader ? parseInt(Array.isArray(metaintHeader) ? metaintHeader[0] : metaintHeader, 10) : 0;

          if (!metaint || isNaN(metaint) || metaint <= 0) {
            res.destroy();
            return resolve({
              title: null,
              artist: null,
              raw: null,
              station: icyStationName,
            });
          }

          let buffer = Buffer.alloc(0);
          let resolved = false;

          res.on("data", (chunk: Buffer) => {
            if (resolved) return;
            buffer = Buffer.concat([buffer, chunk]);

            if (buffer.length >= metaint + 1) {
              const lenByte = buffer[metaint];
              const metaLength = lenByte * 16;

              if (metaLength > 0 && buffer.length >= metaint + 1 + metaLength) {
                resolved = true;
                const rawMeta = buffer.subarray(metaint + 1, metaint + 1 + metaLength).toString("utf8");
                res.destroy();

                const match = /StreamTitle=['"](.*?)['"];/i.exec(rawMeta);
                const rawTitle = match ? match[1] : null;
                const { title, artist } = parseStreamTitle(rawTitle || "");

                return resolve({
                  title,
                  artist,
                  raw: cleanString(rawTitle),
                  station: icyStationName,
                });
              } else if (metaLength === 0) {
                resolved = true;
                res.destroy();
                return resolve({
                  title: null,
                  artist: null,
                  raw: null,
                  station: icyStationName,
                });
              }
            }

            if (buffer.length > 262144) {
              resolved = true;
              res.destroy();
              resolve({
                title: null,
                artist: null,
                raw: null,
                station: icyStationName,
              });
            }
          });

          res.on("error", () => {
            if (!resolved) {
              resolved = true;
              resolve({ title: null, artist: null, raw: null, station: icyStationName });
            }
          });
        }
      );

      req.on("error", () => {
        resolve({ title: null, artist: null, raw: null, station: null });
      });

      req.setTimeout(3500, () => {
        req.destroy();
        resolve({ title: null, artist: null, raw: null, station: null });
      });

      req.end();
    } catch {
      resolve({ title: null, artist: null, raw: null, station: null });
    }
  });
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const cached = cache.get(url);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data, {
      headers: {
        "Cache-Control": "public, max-age=8, s-maxage=8, stale-while-revalidate=15",
      },
    });
  }

  const data = await fetchIcyFromStream(url);

  cache.set(url, {
    data,
    expiresAt: now + CACHE_TTL_MS,
  });

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=8, s-maxage=8, stale-while-revalidate=15",
    },
  });
}
