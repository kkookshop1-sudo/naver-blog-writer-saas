import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const blogId = request.nextUrl.searchParams.get("blogId");
  if (!blogId) {
    return NextResponse.json({ error: "blogId is required" }, { status: 400 });
  }

  try {
    // 1. Try PC Page first
    let res = await fetch(`https://blog.naver.com/PostList.naver?blogId=${blogId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://blog.naver.com/"
      }
    });
    
    let html = await res.text();
    
    let categoryMatch = html.match(/parent\.categoryList\s*=\s*(\[[\s\S]*?\]);/);
    
    if (!categoryMatch) {
      // 2. Try Mobile Page Fallback (Often easier to parse)
      res = await fetch(`https://m.blog.naver.com/${blogId}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        }
      });
      html = await res.text();
      // Mobile often has: "categoryName":"..."
      const names = Array.from(html.matchAll(/"categoryName"\s*:\s*"(.*?)"/g)).map(m => m[1]);
      const ids = Array.from(html.matchAll(/"categoryNo"\s*:\s*(\d+)/g)).map(m => m[1]);
      
      if (names.length > 0) {
        const categories = names.map((name, i) => ({
          name: decodeURIComponent(JSON.parse(`"${name}"`)), // Handle escapes
          id: ids[i]
        })).filter((v, i, a) => a.findIndex(t => t.name === v.name) === i) // Unique
        .filter(c => c.name && !["전체카테고리", "공지사항", "메모"].includes(c.name));
        
        if (categories.length > 0) return NextResponse.json({ categories });
      }
    } else {
      const categoriesJson = categoryMatch[1];
      const names = Array.from(categoriesJson.matchAll(/"categoryName"\s*:\s*"(.*?)"/g)).map(m => m[1]);
      const ids = Array.from(categoriesJson.matchAll(/"categoryNo"\s*:\s*(\d+)/g)).map(m => m[1]);
      
      const categories = names.map((name, i) => ({
        name: name.replace(/\\u([\d\w]{4})/gi, (_match: string, grp: string) => String.fromCharCode(parseInt(grp, 16))),
        id: ids[i]
      })).filter(c => c.name && !["전체카테고리", "공지사항"].includes(c.name));
      
      return NextResponse.json({ categories });
    }
    
    return NextResponse.json({ categories: [], message: "No categories found or private blog" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
