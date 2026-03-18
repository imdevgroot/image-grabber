"use client";

import { useState, useCallback, useRef, useEffect } from "react";

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

const ScrapeIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
const SearchIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const HistoryIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>;

const BASE_TABS = [
  { id: "scraper" as Tab, label: "URL Scraper", icon: <ScrapeIcon /> },
  { id: "pexels"  as Tab, label: "Pexels Search", icon: <SearchIcon /> },
  { id: "history" as Tab, label: "History", icon: <HistoryIcon /> },
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

  const clearHistory = () => {
    try { localStorage.removeItem("ig_history"); } catch {}
    setHistory([]);
  };

  // Ctrl+A to select all images
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      if (tab === 'scraper' && scrapeImages.length > 0) {
        setScrapeSelected(new Set(scrapeImages.map(i => i.url)));
      } else if (tab === 'pexels' && pexelsImages.length > 0) {
        setPexelsSelected(new Set(pexelsImages.map(i => i.url)));
      }
    }
  }, [tab, scrapeImages, pexelsImages]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5, color: "#fff" }}>
            Image Grabber
          </span>
          <span style={{
            fontSize: 11, color: "#3b82f6", background: "rgba(59,130,246,0.1)",
            padding: "3px 10px", borderRadius: 20, fontWeight: 700,
            border: "1px solid rgba(59,130,246,0.2)", letterSpacing: "0.04em",
          }}>
            NuPeeks
          </span>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            Scrape
          </span>
          <span>·</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Search
          </span>
          <span>·</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>

        {/* Tab bar */}
        <div className="tab-bar animate-fade-in" style={{ display: "flex", gap: 6, marginBottom: 28, background: "#141414", padding: 5, borderRadius: 12, border: "1px solid #1f1f1f", width: "fit-content", flexWrap: "wrap" }}>
          {BASE_TABS.map(t => {
            const badge = t.id === "scraper" ? scrapeImages.length : t.id === "pexels" ? pexelsImages.length : history.length;
            return (
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
                {badge > 0 && (
                  <span style={{
                    background: tab === t.id ? "rgba(255,255,255,0.25)" : "rgba(59,130,246,0.2)",
                    color: tab === t.id ? "#fff" : "#3b82f6",
                    fontSize: 10, fontWeight: 800,
                    padding: "1px 6px", borderRadius: 10,
                    minWidth: 18, textAlign: "center",
                  }}>{badge}</span>
                )}
              </button>
            );
          })}
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
                  hint="Ctrl+A to select all"
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
                  hint="Ctrl+A to select all"
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "#6b7280" }}>
                Last {MAX_HISTORY} downloads
              </h2>
              {history.length > 0 && (
                <button onClick={clearHistory} style={{
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                  color: "#fca5a5", fontSize: 12, fontWeight: 600, padding: "5px 12px",
                  borderRadius: 7, cursor: "pointer", transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  Clear History
                </button>
              )}
            </div>
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      {msg}
    </div>
  );
}

function ActionRow({ count, selected, onSelectAll, onClear, onDownload, downloading, hint }: {
  count: number; selected: number;
  onSelectAll: () => void; onClear: () => void;
  onDownload: () => void; downloading: boolean; hint?: string;
}) {
  return (
    <div className="action-row" style={{
      display: "flex", gap: 10, alignItems: "center",
      marginBottom: 16, flexWrap: "wrap",
    }}>
      <span style={{ color: "#6b7280", fontSize: 13 }}>
        <strong style={{ color: "#94a3b8" }}>{count}</strong> images ·{" "}
        <strong style={{ color: selected > 0 ? "#3b82f6" : "#6b7280" }}>{selected}</strong> selected
        {hint && <span style={{ marginLeft: 8, fontSize: 11, color: "#374151" }}>({hint})</span>}
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
        {downloading ? <><Spinner /> Zipping&hellip;</> : (
          <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download ({selected})</>
        )}
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
                {img.photographer}
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
