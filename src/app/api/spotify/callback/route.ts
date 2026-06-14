import { NextRequest, NextResponse } from "next/server";
import { getSpotifyRedirectUri } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/?spotify_error=1", req.url));
  }

  // Use the same redirect URI logic — must match what was sent to Spotify
  const redirectUri =
    process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI ||
    `${req.nextUrl.origin}/api/spotify/callback`;

  const body = new URLSearchParams({
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.redirect(
      new URL(`/?spotify_error=1&detail=${encodeURIComponent(detail)}`, req.url)
    );
  }

  const data = await res.json();

  const response = NextResponse.redirect(new URL("/?tab=podcasts", req.url));
  response.cookies.set("spotify_access_token", data.access_token, {
    httpOnly: false,
    maxAge: data.expires_in,
    path: "/",
    sameSite: "lax",
  });
  if (data.refresh_token) {
    response.cookies.set("spotify_refresh_token", data.refresh_token, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
    });
  }
  return response;
}
