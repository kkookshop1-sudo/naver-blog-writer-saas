import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "edge";

function buildPrompt(
  topic: string,
  keywords: string,
  audience: string,
  tone: string,
  style: string,
  language: string,
  imageUrls: string[]
) {
  const systemPrompt = `You are a professional Naver Blog writer with 10 years of experience.
Write a human-centered blog post that attracts readers and looks 100% authentic.

CRITICAL RULES:
1. NEVER use # for headings. Use subheadings like "[Title]" or bold text.
2. The '#' character is ONLY allowed for tags at the very end of the post.
3. Completely avoid "In conclusion", "I hope this helps", or robotic patterns.
4. Use conversational language, asking the reader's opinion or sharing feelings.
5. Topic: ${topic}.
6. Keywords: ${keywords}.
7. Language: ${language}. Tone: ${tone}. Style: ${style}. Audience: ${audience}.

Image Placement:
Insert [IMAGE_PLACEHOLDER_X] (X=0 to ${imageUrls.length - 1}) where images fit the narrative naturally.`;

  const userPrompt = `Write a professional personal blog post about: ${topic}.
NO # in body. Use bold text for sections.
Keywords: ${keywords}.`;

  return { systemPrompt, userPrompt };
}

export async function POST(req: Request) {
  try {
    const body: any = await req.json();
    const {
      topic = "",
      keywords = "",
      targetAudience = "",
      tone = "neutral",
      style = "informative",
      language = "ko",
      imageUrls = [],
      provider = "openai",
      apiKey = "",
      contentOptions = {},
    } = body;

    // 🐿️ 모델 선택 로직 보강 (2026년 초(超)최신 3.1 족보 반영!)
    let activeModel = body.model || (provider === "openai" ? "gpt-4o-mini" : "gemini-3.1-flash-lite-preview");
    
    // 낡은 모델명(1.5, 2.0 등)이 들어오면 최신형 gemini-3.1-flash-lite-preview로 자동 변신!
    if (provider === "gemini" && (activeModel.includes("gpt") || activeModel.includes("1.5") || activeModel.includes("2.0") || !activeModel)) {
      activeModel = "gemini-3.1-flash-lite-preview";
    }

    const { systemPrompt, userPrompt } = buildPrompt(
      topic,
      keywords,
      targetAudience,
      tone,
      style,
      language,
      imageUrls
    );

    if (provider === "gemini") {
      try {
        const genAI = new GoogleGenerativeAI(apiKey.trim());
        const geminiModel = genAI.getGenerativeModel({
          model: activeModel, 
        });

        // Prepare content parts for Gemini
        const contents = [];
        
        // Add images if any
        const imageParts = await Promise.all(
          imageUrls.map(async (url: string) => {
            if (url.startsWith("data:")) {
              const [mime, base64] = url.split(";base64,");
              return {
                inlineData: {
                  data: base64,
                  mimeType: mime.split(":")[1],
                },
              };
            }
            try {
               const response = await fetch(url);
               const buffer = await response.arrayBuffer();
               return {
                 inlineData: {
                   data: Buffer.from(buffer).toString("base64"),
                   mimeType: response.headers.get("content-type") || "image/jpeg",
                 },
               };
            } catch (err) {
               console.error("Image fetch failed:", url);
               return null;
            }
          })
        );
        
        const validImageParts = imageParts.filter(p => p !== null) as any[];

        const result = await geminiModel.generateContent([
          systemPrompt,
          userPrompt,
          ...validImageParts,
        ]);
        const text = result.response.text();
        return NextResponse.json({ text: text.replace(/\*/g, "") });
      } catch (e) {
        return NextResponse.json(
          { error: (e as Error).message },
          { status: 500 }
        );
      }
    }

    if (provider === "openai") {
      try {
        const contentParts: any[] = [
          { type: "text", text: `${systemPrompt}\n\n${userPrompt}` },
        ];

        // Add images for GPT-4o-mini/GPT-4o
        for (const img of imageUrls) {
          if (img.startsWith("http")) {
            contentParts.push({
              type: "image_url",
              image_url: { url: img },
            });
          } else if (img.startsWith("data:image")) {
            contentParts.push({
              type: "image_url",
              image_url: { url: img },
            });
          }
        }

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            model: activeModel, // Use multimodal capable model
            messages: [{ role: "user", content: contentParts }],
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          return NextResponse.json(
            { error: data?.error?.message || `API ${res.status}` },
            { status: 502 }
          );
        }

        const text = data?.choices?.[0]?.message?.content?.trim() ?? "";
        return NextResponse.json({ text: text.replace(/\*/g, "") });
      } catch (e) {
        return NextResponse.json(
          { error: (e as Error).message },
          { status: 502 }
        );
      }
    }
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
