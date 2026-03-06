import { useState, useRef, useCallback } from "react";

const T = {
  en: {
    appTitle: "Crop Disease & Pest Diagnosis",
    appSubtitle: "AI-POWERED AGRICULTURAL ANALYSIS",
    uploadTitle: "Drop your crop photo here",
    uploadSub: "or click to browse files",
    uploadFormats: "JPEG · PNG · WEBP",
    diagnoseBtn: "🔍 Run AI Diagnosis",
    loadingTitle: "Analysing with AI…",
    loadingSub: "This usually takes 5–10 seconds",
    errorMsg: "An error occurred during diagnosis. Please try again.",
    severityLabel: "Severity",
    confidenceLabel: "AI Confidence",
    sectionDiagnosis: "Diagnosis",
    sectionPhoto: "📸 Your Photo",
    photoYours: "Your Photo",
    sectionCause: "Cause",
    sectionTreatment: "Treatment Steps",
    sectionProducts: "🛒 Recommended Products",
    activeIngredient: "Active ingredient:",
    sectionPrevention: "Prevention",
    resetBtn: "↩ Diagnose another photo",
    footer: "⚠ AI diagnosis is for reference only.\nConsult a qualified agronomist before making major treatment decisions.",
    apiError: "Please send a clearer photo. Capture the affected area up close.",
    diagnosisPromptLang: "English",
    severityMap: { Mild: "Mild", Moderate: "Moderate", Severe: "Severe" },
    confidenceMap: { High: "High", Medium: "Medium", Low: "Low" },
  },
  ja: {
    appTitle: "農作物病害虫診断",
    appSubtitle: "AI農業診断システム",
    uploadTitle: "作物の写真をここにドロップ",
    uploadSub: "またはクリックしてファイルを選択",
    uploadFormats: "JPEG · PNG · WEBP 対応",
    diagnoseBtn: "🔍 AI診断を開始する",
    loadingTitle: "AIが解析中…",
    loadingSub: "通常5〜10秒かかります",
    errorMsg: "診断中にエラーが発生しました。もう一度お試しください。",
    severityLabel: "深刻度",
    confidenceLabel: "AI信頼度",
    sectionDiagnosis: "診断結果",
    sectionPhoto: "📸 写真",
    photoYours: "あなたの写真",
    sectionCause: "原因",
    sectionTreatment: "対処法",
    sectionProducts: "🛒 推奨製品",
    activeIngredient: "有効成分：",
    sectionPrevention: "予防策",
    resetBtn: "↩ 別の写真を診断する",
    footer: "⚠ AI診断は参考情報です。\n重大な判断をする前に専門家にご相談ください。",
    apiError: "より鮮明な写真を送ってください。患部をアップで撮影してください。",
    diagnosisPromptLang: "Japanese",
    severityMap: { Mild: "軽度", Moderate: "中度", Severe: "重度" },
    confidenceMap: { High: "高", Medium: "中", Low: "低" },
  },
};

const makeDiagnosisPrompt = (lang) => `You are an expert agricultural pathologist and pest management specialist. Analyse the crop photo and respond ONLY with the following JSON, no preamble.

{
  "disease": "Disease or pest name in ${lang} (include scientific name in parentheses)",
  "cause": "Brief explanation of the cause (1-2 sentences) in ${lang}",
  "severity": "mild|moderate|severe",
  "severityLabel": "Mild|Moderate|Severe",
  "treatments": ["Treatment step 1 in ${lang}", "Treatment step 2 in ${lang}", "Treatment step 3 in ${lang}"],
  "products": [
    {
      "name": "Product brand name",
      "activeIngredient": "Active ingredient(s)",
      "type": "Fungicide|Insecticide|Bactericide|Organic",
      "usage": "Brief usage instruction in ${lang}",
      "notes": "Safety or resistance notes in ${lang} (optional, omit if none)"
    }
  ],
  "prevention": "One-sentence prevention tip in ${lang}",
  "confidence": "high|medium|low",
  "confidenceLabel": "High|Medium|Low"
}

For products: list 1-3 widely available commercial products. Return [] if none known.
If image does not clearly show a plant/disease: { "error": "true" }`;

const SEV = {
  mild:     { bg: "#f0fdf4", border: "#22c55e", text: "#15803d" },
  moderate: { bg: "#fffbeb", border: "#f59e0b", text: "#b45309" },
  severe:   { bg: "#fef2f2", border: "#ef4444", text: "#b91c1c" },
};
const CONF = { high: "#16a34a", medium: "#d97706", low: "#dc2626" };
const TYPE_STYLE = {
  Fungicide:   { bg: "#faf5ff", border: "#a855f7", badge: "#7c3aed", badgeText: "#fff" },
  Insecticide: { bg: "#fff1f2", border: "#f43f5e", badge: "#e11d48", badgeText: "#fff" },
  Bactericide: { bg: "#eff6ff", border: "#3b82f6", badge: "#2563eb", badgeText: "#fff" },
  Organic:     { bg: "#f0fdf4", border: "#22c55e", badge: "#16a34a", badgeText: "#fff" },
};

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function LangToggle({ lang, setLang }) {
  return (
    <div style={{ display: "flex", alignItems: "center", background: "#f1f5f9", borderRadius: 8, padding: 3, gap: 2 }}>
      {["en", "ja"].map((l) => (
        <button key={l} onClick={() => setLang(l)} style={{
          padding: "5px 14px", borderRadius: 6, border: "none",
          fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.18s",
          background: lang === l ? "#fff" : "transparent",
          color: lang === l ? "#0f172a" : "#94a3b8",
          boxShadow: lang === l ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
        }}>
          {l === "en" ? "EN" : "日本語"}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const [lang, setLang]       = useState("en");
  const [image, setImage]     = useState(null);
  const [imageBase64, setB64] = useState(null);
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const t = T[lang];

  const processFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setResult(null); setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setImage(dataUrl);
      setB64({ data: dataUrl.split(",")[1], type: file.type });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    processFile(e.dataTransfer.files[0]);
  }, [processFile]);

  const handleDiagnose = async () => {
    if (!imageBase64) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1200,
          system: makeDiagnosisPrompt(t.diagnosisPromptLang),
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: imageBase64.type, data: imageBase64.data } },
            { type: "text", text: "Please diagnose this crop photo." }
          ]}]
        })
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (parsed.severityLabel) parsed.severityLabel = t.severityMap[parsed.severityLabel] || parsed.severityLabel;
      if (parsed.confidenceLabel) parsed.confidenceLabel = t.confidenceMap[parsed.confidenceLabel] || parsed.confidenceLabel;
      setResult(parsed);
    } catch {
      setError(t.errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setImage(null); setB64(null); setResult(null); setError(null); };
  const sev = result && !result.error ? SEV[result.severity] || SEV.mild : null;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#1e293b" }}>
      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
      `}</style>

      {/* Top bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>🌾</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", lineHeight: 1.2 }}>{t.appTitle}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.06em" }}>{t.appSubtitle}</div>
          </div>
        </div>
        <LangToggle lang={lang} setLang={(l) => { setLang(l); setResult(null); setError(null); }} />
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 64px" }}>

        {/* Upload zone */}
        {!image && (
          <div
            onClick={() => fileRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{ border: `2px dashed ${dragOver ? "#22c55e" : "#cbd5e1"}`, borderRadius: 16, padding: "60px 32px", textAlign: "center", cursor: "pointer", background: dragOver ? "#f0fdf4" : "#fff", transition: "all 0.2s", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          >
            <div style={{ fontSize: 52, marginBottom: 16 }}>📷</div>
            <p style={{ fontSize: 17, fontWeight: 600, color: "#0f172a", margin: "0 0 8px" }}>{t.uploadTitle}</p>
            <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 16px" }}>{t.uploadSub}</p>
            <span style={{ display: "inline-block", padding: "6px 18px", background: "#f1f5f9", borderRadius: 8, fontSize: 12, color: "#94a3b8" }}>{t.uploadFormats}</span>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => processFile(e.target.files[0])} />
          </div>
        )}

        {/* Preview */}
        {image && !result && (
          <div style={{ position: "relative", marginBottom: 16, borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
            <img src={image} alt="uploaded" style={{ width: "100%", maxHeight: 360, objectFit: "cover", display: "block" }} />
            <button onClick={reset} style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.55)", border: "none", color: "#fff", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        )}

        {/* Diagnose button */}
        {image && !result && !loading && (
          <button onClick={handleDiagnose}
            style={{ width: "100%", padding: "15px", background: "#16a34a", border: "none", borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer", marginBottom: 16, boxShadow: "0 4px 14px rgba(22,163,74,0.3)", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#15803d"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#16a34a"; e.currentTarget.style.transform = "none"; }}
          >
            {t.diagnoseBtn}
          </button>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "48px 24px", textAlign: "center", marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
            <div style={{ width: 44, height: 44, border: "3px solid #e2e8f0", borderTop: "3px solid #16a34a", borderRadius: "50%", animation: "spin 0.9s linear infinite", margin: "0 auto 20px" }} />
            <p style={{ fontWeight: 600, color: "#0f172a", margin: "0 0 4px", fontSize: 16 }}>{t.loadingTitle}</p>
            <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>{t.loadingSub}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "14px 18px", marginBottom: 16, color: "#991b1b", fontSize: 14 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Result card */}
        {result && !result.error && sev && (
          <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #e2e8f0", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", overflow: "hidden", animation: "fadeUp 0.4s ease" }}>

            {/* Severity banner */}
            <div style={{ background: sev.bg, borderBottom: `3px solid ${sev.border}`, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: sev.text, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>{t.severityLabel}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: sev.text }}>{result.severityLabel}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>{t.confidenceLabel}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: CONF[result.confidence] || "#64748b" }}>{result.confidenceLabel}</div>
              </div>
            </div>

            <div style={{ padding: "28px 24px" }}>

              {/* Diagnosis */}
              <Section label={t.sectionDiagnosis}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", lineHeight: 1.4 }}>{result.disease}</div>
              </Section>

              {/* Photo */}
              <Section label={t.sectionPhoto}>
                <div style={{ borderRadius: 12, overflow: "hidden", border: "2px solid #e2e8f0" }}>
                  <img src={image} alt="Your photo" style={{ width: "100%", maxHeight: 320, objectFit: "cover", display: "block" }} />
                  <div style={{ padding: "8px 12px", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.photoYours}</div>
                  </div>
                </div>
              </Section>

              {/* Cause */}
              <Section label={t.sectionCause}>
                <p style={{ margin: 0, color: "#374151", lineHeight: 1.75, fontSize: 15 }}>{result.cause}</p>
              </Section>

              {/* Treatment */}
              <Section label={t.sectionTreatment}>
                {result.treatments?.map((tr, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                    <span style={{ minWidth: 26, height: 26, background: "#16a34a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ color: "#1e293b", fontSize: 14, lineHeight: 1.6 }}>{tr}</span>
                  </div>
                ))}
              </Section>

              {/* Products */}
              {result.products?.length > 0 && (
                <Section label={t.sectionProducts}>
                  {result.products.map((prod, i) => {
                    const tc = TYPE_STYLE[prod.type] || TYPE_STYLE.Organic;
                    return (
                      <div key={i} style={{ marginBottom: 12, padding: "16px", background: tc.bg, borderRadius: 12, border: `1px solid ${tc.border}` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                          <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 15 }}>💊 {prod.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: tc.badge, color: tc.badgeText, letterSpacing: "0.06em" }}>{prod.type}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                          {t.activeIngredient} <strong style={{ color: "#374151" }}>{prod.activeIngredient}</strong>
                        </div>
                        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, marginBottom: prod.notes ? 8 : 0 }}>{prod.usage}</div>
                        {prod.notes && (
                          <div style={{ fontSize: 12, color: "#92400e", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "8px 12px" }}>
                            ⚠ {prod.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Section>
              )}

              {/* Prevention */}
              <Section label={t.sectionPrevention}>
                <div style={{ padding: "14px 16px", background: "#f0fdf4", borderRadius: 10, borderLeft: "4px solid #22c55e", color: "#166534", fontSize: 14, lineHeight: 1.7 }}>
                  🌿 {result.prevention}
                </div>
              </Section>

              {/* Reset button */}
              <button onClick={reset}
                style={{ width: "100%", padding: "12px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, color: "#475569", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#e2e8f0"}
                onMouseLeave={e => e.currentTarget.style.background = "#f1f5f9"}
              >
                {t.resetBtn}
              </button>

            </div>
          </div>
        )}

        {/* API error */}
        {result?.error && (
          <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12, padding: "20px 24px", color: "#92400e", textAlign: "center", fontSize: 15 }}>
            📷 {t.apiError}
          </div>
        )}

        <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 11, marginTop: 48, lineHeight: 1.8 }}>
          {t.footer.split("\n").map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
        </p>

      </div>
    </div>
  );
}
