"use client";

import { useState, useCallback, useRef } from "react";

type Tab = "scraper" | "pexels" | "history";

interface ImageItem {
  url: string;
  thumb?: string;
  alt?: string;
  photographer?: string;
}

interface HistoryItem {
  filename: string;
  url: string;
  downloadedAt: string;
}

const MAX_HISTORY = 20;

function saveHistory(items: ImageItem[]) {
  try {
    const existing: HistoryItem[] = JSON.parse(localStorage.getItem("ig_history") || "[]");
    const newItems: HistoryItem[] = items.map(img => ({
      filename: img.url.split("/").pop()?.split("?")[0] || "image.jpg",
      url: img.url,
      downloadedAt: new Date().toISOString(),
    }));
    const merged = [...newItems, ...existing].slice(0, MAX_HISTORY);
    localStorage.setItem("ig_history", JSON.stringify(merged));
  } catch {}
}

function getHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem("ig_history") || "[]");
  } catch { return []; }
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "scraper", label: "URL Scraper", icon: "🔗" },
  { id: "pexels",  label: "Pexels Search", icon: "📷" },
  { id: "history", label: "History",      icon: "📁" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("scraper");

  const [scrapeUrl,      setScrapeUrl]      = useState("");
  const [scrapeImages,   setScrapeImages]   = useState<ImageItem[]>([]);
  const [scrapeSelected, setScrapeSelected] = useState<Set<string>>(new Set());
  const [scrapeLoading,  setScrapeLoading]  = useState(false);
  const [scrapeError,    setScrapeError]    = useState("");

  const [pexelsQuery,    setPexelsQuery]    = useState("");
  const [pexelsImages,   setPexelsImages]   = useState<ImageItem[]>([]);
  const [pexelsSelected, setPexelsSelected] = useState<Set<string>>(new Set());
  const [pexelsLoading,  setPexelsLoading]  = useState(false);
  const [pexelsError,    setPexelsError]    = useState("");

  const [downloading, setDownloading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return;
    setScrapeLoading(true); setScrapeError(""); setScrapeImages([]); setScrapeSelected(new Set());
    try {
      const res = await fetch("/api/scrape", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scrapeUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to scrape");
      setScrapeImages(data.images || []);
      if (!data.images?.length) setScrapeError("No images found on that page.");
    } catch (e: any) {
      setScrapeError(e.message);
    } finally { setScrapeLoading(false); }
  };

  const handlePexels = async () => {
    if (!pexelsQuery.trim()) return;
    setPexelsLoading(true); setPexelsError(""); setPexelsImages([]); setPexelsSelected(new Set());
    try {
      const res = await fetch("/api/pexels", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: pexelsQuery.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to search Pexels");
      setPexelsImages(data.photos || []);
      if (!data.photos?.length) setPexelsError("No photos found for that query.");
    } catch (e: any) {
      setPexelsError(e.message);
    } finally { setPexelsLoading(false); }
  };

  const toggle = (set: Set<string>, url: string) => {
    const next = new Set(set);
    next.has(url) ? next.delete(url) : next.add(url);
    return next;
  };

  const handleDownload = async (images: ImageItem[], selected: Set<string>, source: string) => {
    const urls = images.filter(i => selected.has(i.url)).map(i => i.url);
    if (!urls.length) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/download", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Download failed"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `images-${source}-${Date.now()}.zip`; a.click();
      URL.revokeObjectURL(url);
      saveHistory(images.filter(i => selected.has(i.url)));
      setHistory(getHistory());
    } catch (e: any) {
      alert("Download error: " + e.message);
    } finally { setDownloading(false); }
  };

  const loadHistory = useCallback(() => setHistory(getHistory()), []);

  // Skeleton cards for loading state
  const SkeletonGrid = () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 130, borderRadius: 8 }} />
      ))}
    </div>
  );

  // Empty state component
  const EmptyState = ({ icon, title, desc }: { icon: string; title: string; desc: string }) => (
    <div style={{
      textAlign: "center", padding: "48px 24px",
      background: "#141414", borderRadius: 14, border: "1px solid #1f1f1f",
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#fff' }}>{title}</h3>
      <p style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.6 }}>{desc}</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", color: "#e2e8f0" }}>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #1a1a1a",
        padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(15,15,15,0.95)",
        position: "sticky", top: 0, zIndex: 50,
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>
            🖼️ Image Grabber
          </span>
          <span style={{
            fontSize: 11, color: "#3b82f6", background: "rgba(59,130,246,0.1)",
            padding: "3px 10px", borderRadius: 20, fontWeight: 700,
            border: "1px solid rgba(59,130,246,0.2)", letterSpacing: "0.04em",
          }}>
            NuPeeks
          </span>
        </div>
        <div style={{ fontSize: 12, color: "#374151" }}>
          Scrape · Search · Download
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>

        {/* Tab bar */}
        <div className="tab-bar animate-fade-in" style={{ display: "flex", gap: 6, marginBottom: 28, background: "#141414", padding: 5, borderRadius: 12, border: "1px solid #1f1f1f", width: "fit-content" }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); if (t.id === "history") loadHistory(); }}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: "none",
                fontSize: 13, fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.18s",
                background: tab === t.id ? "#3b82f6" : "transparent",
                color: tab === t.id ? "#fff" : "#6b7280",
                display: "flex", alignItems: "center", gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* URL Scraper */}
        {tab === "scraper" && (
          <div className="animate-fade-up">
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <input
                type="url"
                value={scrapeUrl}
                onChange={e => setScrapeUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleScrape()}
                placeholder="https://example.com/gallery"
                style={inputStyle}
              />
              <button onClick={handleScrape} disabled={scrapeLoading} style={btnPrimary}>
                {scrapeLoading ? <Spinner /> : "Scrape"}
              </button>
            </div>

            {scrapeError && <ErrorBanner msg={scrapeError} />}

            {scrapeLoading && <SkeletonGrid />}

            {!scrapeLoading && scrapeImages.length === 0 && !scrapeError && (
              <EmptyState icon="🔗" title="Enter a URL to scrape" desc="Paste any webpage URL above and we'll find all images on it." />
            )}

            {scrapeImages.length > 0 && (
              <div className="animate-fade-in">
                <ActionRow
                  count={scrapeImages.length}
                  selected={scrapeSelected.size}
                  onSelectAll={() => setScrapeSelected(new Set(scrapeImages.map(i => i.url)))}
                  onClear={() => setScrapeSelected(new Set())}
                  onDownload={() => handleDownload(scrapeImages, scrapeSelected, "scraped")}
                  downloading={downloading}
                />
                <ImageGrid
                  images={scrapeImages}
                  selected={scrapeSelected}
                  onToggle={url => setScrapeSelected(toggle(scrapeSelected, url))}
                />
              </div>
            )}
          </div>
        )}

        {/* Pexels Search */}
        {tab === "pexels" && (
          <div className="animate-fade-up">
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <input
                type="text"
                value={pexelsQuery}
                onChange={e => setPexelsQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handlePexels()}
                placeholder="Search Pexels (e.g. sunset landscape, city skyline)"
                style={inputStyle}
              />
              <button onClick={handlePexels} disabled={pexelsLoading} style={btnPrimary}>
                {pexelsLoading ? <Spinner /> : "Search"}
              </button>
            </div>

            {pexelsError && <ErrorBanner msg={pexelsError} />}

            {pexelsLoading && <SkeletonGrid />}

            {!pexelsLoading && pexelsImages.length === 0 && !pexelsError && (
              <EmptyState icon="📷" title="Search Pexels for free images" desc="Type any keyword above to find high-quality royalty-free photos." />
            )}

            {pexelsImages.length > 0 && (
              <div className="animate-fade-in">
                <ActionRow
                  count={pexelsImages.length}
                  selected={pexelsSelected.size}
                  onSelectAll={() => setPexelsSelected(new Set(pexelsImages.map(i => i.url)))}
                  onClear={() => setPexelsSelected(new Set())}
                  onDownload={() => handleDownload(pexelsImages, pexelsSelected, "pexels")}
                  downloading={downloading}
                />
                <ImageGrid
                  images={pexelsImages}
                  selected={pexelsSelected}
                  onToggle={url => setPexelsSelected(toggle(pexelsSelected, url))}
                  showPhotographer
                />
              </div>
            )}
          </div>
        )}

        {/* History */}
        {tab === "history" && (
          <div className="animate-fade-up">
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18, color: "#6b7280" }}>
              Last {MAX_HISTORY} downloads
            </h2>
            {history.length === 0 ? (
              <EmptyState icon="📁" title="No download history yet" desc="Images you download will appear here." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {history.map((item, i) => (
                  <div key={i} className="animate-fade-up" style={{
                    animationDelay: `${i * 0.04}s`,
                    background: "#1a1a1a", border: "1px solid #222",
                    borderRadius: 10, padding: "10px 14px",
                    display: "flex", alignItems: "center", gap: 12,
                    transition: "border-color 0.2s",
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url} alt={item.filename}
                      style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 7, background: "#111", flexShrink: 0 }}
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: '#e2e8f0' }}>
                        {item.filename}
                      </p>
                      <p style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>
                        {new Date(item.downloadedAt).toLocaleString()}
                      </p>
                    </div>
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      style={{ color: "#3b82f6", fontSize: 12, fontWeight: 600, textDecoration: "none", padding: "5px 10px", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 6, whiteSpace: "nowrap" }}>
                      View ↗
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== SUB-COMPONENTS ===== */

function Spinner() {
  return (
    <span style={{
      width: 16, height: 16, display: "inline-block",
      border: "2px solid rgba(255,255,255,0.25)", borderTop: "2px solid #fff",
      borderRadius: "50%", animation: "spin 0.7s linear infinite",
    }} />
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{
      background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
      borderRadius: 10, padding: "12px 16px",
      color: "#fca5a5", fontSize: 14, marginBottom: 18,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      ⚠️ {msg}
    </div>
  );
}

function ActionRow({ count, selected, onSelectAll, onClear, onDownload, downloading }: {
  count: number; selected: number;
  onSelectAll: () => void; onClear: () => void;
  onDownload: () => void; downloading: boolean;
}) {
  return (
    <div className="action-row" style={{
      display: "flex", gap: 10, alignItems: "center",
      marginBottom: 16, flexWrap: "wrap",
    }}>
      <span style={{ color: "#6b7280", fontSize: 13 }}>
        <strong style={{ color: "#94a3b8" }}>{count}</strong> images ·{" "}
        <strong style={{ color: selected > 0 ? "#3b82f6" : "#6b7280" }}>{selected}</strong> selected
      </span>
      <button onClick={onSelectAll} style={btnSmall}>Select All</button>
      <button onClick={onClear} style={btnSmallGhost}>Clear</button>
      <button
        className="dl-btn"
        onClick={onDownload}
        disabled={downloading || selected === 0}
        style={{
          ...btnPrimary,
          marginLeft: "auto",
          opacity: selected === 0 ? 0.4 : 1,
          cursor: selected === 0 ? "not-allowed" : "pointer",
        }}
      >
        {downloading ? <><Spinner /> Zipping…</> : `⬇ Download (${selected})`}
      </button>
    </div>
  );
}

function ImageGrid({ images, selected, onToggle, showPhotographer }: {
  images: ImageItem[]; selected: Set<string>;
  onToggle: (url: string) => void; showPhotographer?: boolean;
}) {
  return (
    <div className="image-grid" style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
      gap: 10,
    }}>
      {images.map((img, i) => {
        const isSel = selected.has(img.url);
        return (
          <div
            key={img.url}
            onClick={() => onToggle(img.url)}
            style={{
              position: "relative", borderRadius: 10, overflow: "hidden",
              border: isSel ? "2px solid #3b82f6" : "2px solid #222",
              cursor: "pointer", background: "#1a1a1a",
              transition: "all 0.18s",
              boxShadow: isSel ? "0 0 0 1px #3b82f6, 0 4px 16px rgba(59,130,246,0.2)" : "none",
              animationDelay: `${i * 0.03}s`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.thumb || img.url} alt={img.alt || ""}
              style={{ width: "100%", height: 130, objectFit: "cover", display: "block" }}
              onError={e => {
                (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='130'%3E%3Crect fill='%231a1a1a' width='150' height='130'/%3E%3Ctext x='50%25' y='50%25' fill='%23333' text-anchor='middle' dy='.3em' font-size='11'%3ENo preview%3C/text%3E%3C/svg%3E";
              }}
            />

            {/* Selection overlay */}
            {isSel && (
              <div style={{
                position: "absolute", inset: 0,
                background: "rgba(59,130,246,0.12)",
              }} />
            )}

            {/* Checkbox */}
            <div style={{
              position: "absolute", top: 7, right: 7,
              width: 22, height: 22, borderRadius: 6,
              background: isSel ? "#3b82f6" : "rgba(0,0,0,0.65)",
              border: `2px solid ${isSel ? "#3b82f6" : "rgba(255,255,255,0.2)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: "#fff",
              transition: "all 0.15s",
              animation: isSel ? "checkIn 0.25s cubic-bezier(0.4,0,0.2,1)" : "none",
            }}>
              {isSel && "✓"}
            </div>

            {showPhotographer && img.photographer && (
              <div style={{
                fontSize: 10, color: "#6b7280",
                padding: "4px 7px", background: "rgba(0,0,0,0.75)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                📷 {img.photographer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ===== STYLES ===== */
const inputStyle: React.CSSProperties = {
  flex: 1, background: "#1a1a1a", border: "1px solid #222",
  borderRadius: 10, padding: "11px 16px", color: "#e2e8f0",
  fontSize: 14, outline: "none", transition: "border-color 0.2s",
  minWidth: 0,
};

const btnPrimary: React.CSSProperties = {
  background: "#3b82f6", color: "#fff", border: "none",
  borderRadius: 10, padding: "11px 22px", fontSize: 14,
  fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
  display: "flex", alignItems: "center", gap: 6,
  transition: "all 0.18s", flexShrink: 0,
};

const btnSmall: React.CSSProperties = {
  background: "#1a1a1a", color: "#6b7280",
  border: "1px solid #222", borderRadius: 7,
  padding: "6px 12px", fontSize: 12, cursor: "pointer",
  fontWeight: 600, transition: "all 0.15s",
};

const btnSmallGhost: React.CSSProperties = { ...btnSmall, background: "transparent" };
