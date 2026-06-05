import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ ok: false, error: "Missing url parameter" }, { status: 400 });

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ ok: false, error: "Only http and https URLs are supported." });
    }

    // Block hosts known to gate behind login
    const blockedHosts = [
      "twitter.com", "x.com", "instagram.com", "facebook.com", "linkedin.com",
      "tiktok.com", "youtube.com", "reddit.com", "pinterest.com",
      "app.slack.com", "teams.microsoft.com", "discord.com",
      "drive.google.com", "docs.google.com",
      "notion.so", "notion.com", "app.notion.com", "www.notion.com",
      "calendly.com", "zoom.us"
    ];
    const host = parsed.hostname.replace(/^www\./, "");
    for (const blocked of blockedHosts) {
      if (host === blocked || host.endsWith("." + blocked)) {
        return NextResponse.json({
          ok: false,
          error: `${host} requires login or blocks automated fetches. Use a public Gist, GitHub Pages, or a deployed website instead.`
        });
      }
    }

    // Do a HEAD request to verify the URL is reachable
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        headers: { "User-Agent": "WorkProofLinkChecker/1.0" }
      });
      if (response.ok) {
        return NextResponse.json({ ok: true, status: response.status });
      }
      // Some servers don't support HEAD, try GET with a small range
      const getResp = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: { "User-Agent": "WorkProofLinkChecker/1.0", Range: "bytes=0-1023" }
      });
      if (getResp.ok || getResp.status === 206) {
        return NextResponse.json({ ok: true, status: getResp.status });
      }
      return NextResponse.json({
        ok: false,
        error: `URL returned HTTP ${getResp.status}. Make sure it's a publicly accessible link.`
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err: any) {
    if (err.name === "AbortError") {
      return NextResponse.json({ ok: false, error: "URL timed out after 8 seconds." });
    }
    return NextResponse.json({ ok: false, error: "Could not fetch this URL. Use a public link accessible from the open internet." });
  }
}
