"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const CATEGORY_DATA: Record<string, { tip: string; icon: string }> = {
  "제품 사용기": {
    tip: "📢 제품의 실물 사진을 여러 장 올려주세요. 장점과 단점, 실제 사용 팁, 구매 추천 대상을 상세히 적는 것이 좋습니다.",
    icon: "📦"
  },
  "제품 홍보": {
    tip: "🚀 제품의 핵심 셀링 포인트가 잘 보이게 해주세요. 구매 욕구를 자극하는 파격적인 문구와 고퀄리티 제품 샷이 필수입니다.",
    icon: "📣"
  },
  "여행기": {
    tip: "✈️ 여행지의 분위기가 느껴지는 고해상도 사진을 넣어주세요. 추천 일정, 예산, 이동 수단 정보를 넣으면 지수가 올라갑니다.",
    icon: "🏔️"
  },
  "일상": {
    tip: "☕ 친근한 말투로 오늘의 이야기를 들려주세요. 진솔한 사진 한 장이 독자의 공감을 이끄는 데 큰 역할을 합니다.",
    icon: "🏠"
  },
  "개인 블로그": {
    tip: "📝 생각이나 정보를 자유롭게 기록해 보세요. 일기처럼 편하게 쓰되 감성이 녹아들면 독자에게 더 가깝게 다가갈 수 있습니다.",
    icon: "🖋️"
  },
  "정보성": {
    tip: "💡 핵심 정보를 정확하고 깔끔하게 전달하는 것이 포인트입니다. 소제목을 잘 활용하여 가독성을 높여보세요.",
    icon: "💎"
  },
  "지식공유": {
    tip: "📖 전문적인 정보를 독자 눈높이에서 정리하면 가독성이 좋아집니다. 참고할 수 있는 링크나 도표 이미지를 활용해 보세요.",
    icon: "🎓"
  }
};

const CATEGORIES = Object.keys(CATEGORY_DATA);

export default function MainPage() {
  const [topic, setTopic] = useState("");
  const [keyword, setKeyword] = useState("");
  const [link, setLink] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [imageList, setImageList] = useState<string[]>([]);
  const [naverId, setNaverId] = useState("");
  const [tistoryId, setTistoryId] = useState("");
  const [platform, setPlatform] = useState<"naver" | "tistory">("naver");
  const [aiProvider, setAiProvider] = useState<"openai" | "gemini">("openai");
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [relatedKeywords, setRelatedKeywords] = useState<string[]>([]);
  const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);
  const [showTopicSuggest, setShowTopicSuggest] = useState(false);
  const [copied, setCopied] = useState(false);

  const topicSuggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const topicWrapperRef = useRef<HTMLDivElement>(null);

  // Persistence
  useEffect(() => {
    const savedNId = localStorage.getItem("naverId") || "";
    const savedTId = localStorage.getItem("tistoryId") || "";
    const savedPlat = (localStorage.getItem("platform") as any) || "naver";
    const savedOKey = localStorage.getItem("openaiKey") || "";
    const savedGKey = localStorage.getItem("geminiKey") || "";
    setNaverId(savedNId);
    setTistoryId(savedTId);
    setPlatform(savedPlat);
    setOpenaiKey(savedOKey);
    setGeminiKey(savedGKey);
  }, []);

  useEffect(() => { localStorage.setItem("naverId", naverId); }, [naverId]);
  useEffect(() => { localStorage.setItem("tistoryId", tistoryId); }, [tistoryId]);
  useEffect(() => { localStorage.setItem("platform", platform); }, [platform]);
  useEffect(() => { localStorage.setItem("openaiKey", openaiKey); }, [openaiKey]);
  useEffect(() => { localStorage.setItem("geminiKey", geminiKey); }, [geminiKey]);

  const fetchSuggestions = useCallback(async (query: string): Promise<string[]> => {
    if (!query.trim()) return [];
    try {
      const res = await fetch(`/api/naver-suggest?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      return (data.items || []) as string[];
    } catch { return []; }
  }, []);

  useEffect(() => {
    if (!topic.trim()) { setTopicSuggestions([]); setShowTopicSuggest(false); return; }
    if (topicSuggestTimer.current) clearTimeout(topicSuggestTimer.current);
    topicSuggestTimer.current = setTimeout(async () => {
      const list = await fetchSuggestions(topic);
      setTopicSuggestions(list);
      setShowTopicSuggest(list.length > 0);
    }, 350);
  }, [topic, fetchSuggestions]);

  const handleAddImageUrl = () => {
    const url = prompt("이미지 주소 (HTTP..)를 입력하세요:");
    if (url) setImageList([...imageList, url]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setImageList(prev => [...prev, compressedBase64]);
        };
      };
      reader.readAsDataURL(file);
    });
  };

  const generateAIImage = async () => {
    if (!topic.trim()) return alert("주제를 먼저 입력하세요!");
    const key = aiProvider === "openai" ? openaiKey : geminiKey;
    if (!key.trim()) return alert(`${aiProvider === "openai" ? "OpenAI" : "Gemini"} API 키가 필요합니다.`);
    
    setImageGenerating(true);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: topic, apiKey: key, provider: aiProvider }),
      });
      const data = await res.json();
      if (data.url) setImageList([...imageList, data.url]);
      else alert(data.error || "이미지 생성 실패");
    } finally { setImageGenerating(false); }
  };

  const handleGenerate = async () => {
    const key = aiProvider === "openai" ? openaiKey : geminiKey;
    if (!key.trim()) return alert("API 키가 없습니다.");
    
    setLoading(true);
    try {
      let linkContext = "";
      if (link.trim()) {
        const lRes = await fetch(`/api/analyze-link?url=${encodeURIComponent(link.trim())}`);
        const lData = await lRes.json();
        if (!lData.error) {
          linkContext = `제목: ${lData.title}\n설명: ${lData.desc}\n내용 요약: ${lData.bodyText}`;
        }
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic, keyword, link, category,
          platform,
          provider: aiProvider,
          apiKey: key,
          imageList,
          linkContext
        }),
      });

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setResult(data.text || `오류: ${data.error || "알 수 없는 에러가 발생했습니다."}`);
      } else {
        const text = await res.text();
        if (res.status === 413) {
          setResult("오류: 업로드된 사진의 용량이 너무 큽니다. 사진 개수를 줄이거나 더 작은 사진을 사용해 주세요. (413 Request Entity Too Large)");
        } else {
          setResult(`서버 오류 (${res.status}): ${text.substring(0, 100)}...`);
        }
      }
    } catch (e) {
      setResult(`네트워크 오류 발생: ${(e as Error).message}`);
    } finally { setLoading(false); }
  };
  return (
    <div className="workspace">
      {/* Sidebar: Configuration */}
      <aside className="sidebar">
        <header style={{ marginBottom: 30 }}>
          <h1 style={{ margin: 0, fontSize: "1.6rem", color: platform === "naver" ? "#03C75A" : "#ff521a", fontWeight: 900 }}>
            {platform === "naver" ? "Naver" : "Tistory"} Boss 🐿️
          </h1>
          <p style={{ fontSize: "0.85rem", color: "#666", margin: "5px 0" }}>대표님을 위한 원스톱 블로그 포스팅 솔루션</p>
        </header>

        {/* Platform Selector */}
        <div style={{ display: "flex", gap: "5px", marginBottom: 20 }}>
          <button 
            className={`btn ${platform === "naver" ? "btn-primary" : "btn-secondary"}`} 
            style={{ flex: 1, padding: "8px", fontSize: "0.85rem" }}
            onClick={() => setPlatform("naver")}
          >네이버</button>
          <button 
            className={`btn ${platform === "tistory" ? "btn-primary" : "btn-secondary"}`} 
            style={{ flex: 1, padding: "8px", fontSize: "0.85rem", backgroundColor: platform === "tistory" ? "#ff521a" : "" }}
            onClick={() => setPlatform("tistory")}
          >티스토리</button>
        </div>

        <section className="card" style={{ padding: "15px", background: platform === "naver" ? "#f8fdfa" : "#fffafa", border: `1.5px dashed ${platform === "naver" ? "#03C75A" : "#ff521a"}` }}>
          <div style={{ display: "flex", gap: "10px", marginBottom: 10 }}>
            <input 
              placeholder={platform === "naver" ? "네이버 ID" : "티스토리 주소 (ID)"} 
              value={platform === "naver" ? naverId : tistoryId} 
              onChange={e => platform === "naver" ? setNaverId(e.target.value) : setTistoryId(e.target.value)} 
              style={{ fontSize: "0.8rem", padding: "8px" }}
            />
            <button 
              className="btn btn-secondary" 
              style={{ padding: "8px" }} 
              onClick={() => {
                const url = platform === "naver" 
                  ? `https://blog.naver.com/${naverId || "id"}/postwrite`
                  : `https://${tistoryId || "id"}.tistory.com/manage/post`;
                window.open(url, "_blank");
              }}
            >이동 ➔</button>
          </div>
          <p style={{ fontSize: "0.75rem", color: "#888", margin: 0 }}>* ID를 입력하면 관리자 페이지로 즉시 연결됩니다.</p>
        </section>

        <div style={{ marginBottom: 20 }}>
          <label className="label">글 카테고리 {CATEGORY_DATA[category]?.icon}</label>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="category-tip">{CATEGORY_DATA[category]?.tip}</div>
        </div>

        <div ref={topicWrapperRef} style={{ position: "relative", marginBottom: 20 }}>
          <label className="label">메인 주제</label>
          <input 
            value={topic} 
            onChange={e => setTopic(e.target.value)} 
            placeholder="제목에 들갈 핵심 주제"
            onFocus={() => topicSuggestions.length > 0 && setShowTopicSuggest(true)}
          />
          {showTopicSuggest && topicSuggestions.length > 0 && (
            <ul className="suggest-list" style={{ position: "absolute", bottom: "100%", width: "100%", zIndex: 100 }}>
              {topicSuggestions.map(s => <li key={s} onClick={() => { setTopic(s); setShowTopicSuggest(false); }}>{s}</li>)}
            </ul>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label className="label">핵심 키워드 (선택사항)</label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input 
              value={keyword} 
              onChange={e => setKeyword(e.target.value)} 
              placeholder="쉼표로 구분 (AI 자동 추천 가능)"
              style={{ fontSize: "0.9rem" }}
            />
          </div>
          <p style={{ fontSize: "0.75rem", color: "#888", marginTop: "5px" }}>* 비워두면 AI가 주제에서 최적의 키워드를 뽑아냅니다.</p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label className="label">참조/제품 링크</label>
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://... (AI가 분석함)" />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label className="label">사진 및 리소스 ({imageList.length})</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: 10 }}>
            <button className="btn btn-secondary" style={{ flex: "1 1 45%", fontSize: "0.8rem", padding: "8px" }} onClick={() => document.getElementById('fileInput')?.click()}>이미지 업로드</button>
            <button className="btn btn-secondary" style={{ flex: "1 1 45%", fontSize: "0.8rem", padding: "8px" }} onClick={handleAddImageUrl}>링크 추가</button>
            <button 
              className="btn btn-secondary" 
              style={{ flex: "1 1 100%", fontSize: "0.8rem", padding: "8px", background: "#fce4ec", border: "1px solid #f8bbd0" }} 
              onClick={generateAIImage}
              disabled={imageGenerating}
            >
              {imageGenerating ? "생성중" : "AI 이미지 생성 🎨"}
            </button>
            <input 
              id="fileInput"
              type="file" 
              multiple 
              accept="image/*" 
              style={{ display: "none" }} 
              onChange={handleFileUpload}
            />
          </div>
          <div className="image-gallery">
            {imageList.map((img, i) => (
              <div key={i} className="image-item">
                <img src={img} alt="Resource" />
                <div className="image-remove" onClick={() => setImageList(imageList.filter((_, idx) => idx !== i))}>×</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: "auto" }}>
          <div style={{ display: "flex", gap: "5px", marginBottom: 10 }}>
            <input 
              type="password" 
              placeholder="API 키" 
              value={aiProvider === "openai" ? openaiKey : geminiKey} 
              onChange={e => aiProvider === "openai" ? setOpenaiKey(e.target.value) : setGeminiKey(e.target.value)}
              style={{ fontSize: "0.8rem" }}
            />
            <select style={{ width: "90px", fontSize: "0.75rem" }} value={aiProvider} onChange={e => setAiProvider(e.target.value as any)}>
              <option value="openai">GPT-4</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleGenerate} disabled={loading}>
            {loading ? "다람쥐가 글 쓰는 중..." : "블로그 본문 생성 🪄"}
          </button>
        </div>
      </aside>

      {/* Main Area: Editor / Result */}
      <main className="editor-area">
        {result ? (
          <div className="result-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
              <h2 style={{ margin: 0, fontSize: "1.2rem" }}>생성된 원고 본문</h2>
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="btn btn-secondary" onClick={() => {
                  navigator.clipboard.writeText(result);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}>
                  {copied ? "복사완료!" : "전체 복사 📋"}
                </button>
                <button 
                   className="btn btn-primary" 
                   onClick={() => {
                     const url = platform === "naver" 
                       ? `https://blog.naver.com/${naverId || "id"}/postwrite`
                       : `https://${tistoryId || "id"}.tistory.com/manage/post`;
                     window.open(url, "_blank");
                   }}
                   style={{ backgroundColor: platform === "tistory" ? "#ff521a" : "" }}
                >
                  {platform === "naver" ? "네이버" : "티스토리"}에 붙여넣기 🚀
                </button>
              </div>
            </div>
            <textarea 
              className="editable-result"
              value={result}
              onChange={e => setResult(e.target.value)}
              placeholder="이곳에서 자유롭게 수정하세요!"
            />
          </div>
        ) : (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#cbd5e1", textAlign: "center" }}>
            <div style={{ fontSize: "4rem", marginBottom: 20 }}>🪄</div>
            <h2 style={{ margin: 0 }}>글쓰기 모드 대기 중</h2>
            <p>좌측에서 설정을 마치고 생성 버튼을 눌러주세요.<br/>대표님을 위한 최고의 원고를 준비하겠습니다!</p>
          </div>
        )}
      </main>
    </div>
  );
}
