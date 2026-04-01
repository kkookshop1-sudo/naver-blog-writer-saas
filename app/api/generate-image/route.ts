import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { prompt, apiKey, provider } = body;

  if (!apiKey || !prompt) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  // OpenAI (DALL-E 3)
  if (provider === "openai") {
    try {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: `${prompt} | High quality blog post illustration, no text, premium look, clean style.`,
          n: 1,
          size: "1024x1024",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(
          { error: data.error?.message || "Image generation failed" },
          { status: 502 }
        );
      }

      return NextResponse.json({ url: data.data[0].url });
    } catch (e) {
      return NextResponse.json(
        { error: (e as Error).message },
        { status: 500 }
      );
    }
  }

  // Gemini (대표님의 최신 모델!)
  if (provider === "gemini") {
    try {
      // 🐿️ 부장님의 긴급 수정: :predict 대신 :generateContent 시도 및 v1beta 유지 (혹은 모델명 최적화)
      // 제미나이 3.1 플래시 모델이 이미지를 뱉으려면 호출 형식이 맞아야 합니다!
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent`, 
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey.trim(),
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: `${prompt} | High quality blog post illustration, no text` }]
            }],
            // 이미지 생성을 위한 환경 설정 (필요 시 조정)
          }),
        }
      );

      const data = await res.json();
      
      // 만약 여전히 에러가 나면 다른 버전(v1)이나 형식을 위해 상세 에러를 띄웁니다.
      if (!res.ok) {
        console.error("Gemini Image API Error:", data);
        return NextResponse.json({ 
          error: data.error?.message || "Gemini Image generation failed",
          details: data.error
        }, { status: 502 });
      }

      // 결과 구조 확인 후 데이터 반환
      const base64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || data.predictions?.[0]?.bytesBase64Encoded;
      if (base64) {
        return NextResponse.json({ url: `data:image/png;base64,${base64}` });
      }
      
      return NextResponse.json({ error: "No image generated in the response", raw: data }, { status: 500 });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }
}
