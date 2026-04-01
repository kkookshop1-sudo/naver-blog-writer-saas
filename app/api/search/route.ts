import { NextRequest, NextResponse } from "next/server";
import { scrapeGoogleImages, scrapeWebInfo, scrapeTodayIssues } from "../../../src/lib/scraper";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "No query provided" }, { status: 400 });
  }

  try {
    console.log(`[Squirrel-Search-API] Processing query: ${query}`);
    
    let images: string[] = [];
    let snippets: { title: string, snippet: string, link: string }[] = [];
    let todayIssues: string[] = [];

    // 1. 오늘의 이슈 수색 (필요 시)
    if (query.includes("오늘의 이슈") || query.includes("오늘의이슈")) {
      todayIssues = await scrapeTodayIssues();
    }

    // 2. 구글 실사 이미지 수색
    images = await scrapeGoogleImages(query);

    // 3. 웹 정보(텍스트) 수색
    snippets = await scrapeWebInfo(query);
    
    return NextResponse.json({ 
      success: true, 
      query,
      message: "실제 웹 정보를 성공적으로 수집했습니다! 이제 대표님을 위한 생생한 포스팅을 준비합니다.",
      images,
      snippets,
      todayIssues
    });
  } catch (e) {
    console.error('[Squirrel-Search-API-Error]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
