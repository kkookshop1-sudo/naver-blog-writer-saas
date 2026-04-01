import { NextRequest, NextResponse } from "next/server";

const SUGGEST_URL = 
  "https://ac.search.naver.com/nx/ac?q=%s&con=1&frm=nx&ans=2&r_format=json&r_enc=UTF-8&st=100";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q || !q.trim()) {
    return NextResponse.json({ items: [] });
  }
  try {
    const url = SUGGEST_URL.replace("%s", encodeURIComponent(q.trim()));
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json"
      }
    });
    const data = await res.json();
    const items = data?.items?.[0]?.map((row: string[]) => row[0]) ?? [];
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ items: [] });
  }
}
