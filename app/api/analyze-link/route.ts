import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const html = await res.text();

    // Extract title
    const title = html.match(/<title>(.*?)<\/title>/i)?.[1] || "";

    // Extract meta description
    const desc = html.match(/<meta name="description" content="(.*?)"/i)?.[1] || "";

    // Very basic body text extraction (cleaning scripts and tags)
    let bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 2000); // Limit to 2000 chars for AI context

    return NextResponse.json({ title, desc, bodyText });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
