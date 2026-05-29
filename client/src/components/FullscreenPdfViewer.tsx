/**
 * FullscreenPdfViewer
 *
 * Takes over the entire screen to display sheet music.
 * - Single page: fills the full viewport with no scrolling required
 * - Multi-page: large left/right tap zones for easy page-turning mid-performance
 * - Works on iPad, iPhone, and desktop browser
 * - Keyboard arrow support (← →) for desktop/stage use
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, X, Loader2, AlertCircle, ExternalLink } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface Props {
  pdfUrl: string;
  songTitle: string;
  onClose: () => void;
  initialPage?: number;
}

export function FullscreenPdfViewer({ pdfUrl, songTitle, onClose, initialPage = 1 }: Props) {
  const pageKey = `maggie-pdf-last-page:${pdfUrl}`;
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(() => {
    try {
      const saved = Number(window.localStorage.getItem(pageKey));
      return Number.isFinite(saved) && saved > 0 ? saved : initialPage;
    } catch {
      return initialPage;
    }
  });
  const [fitMode, setFitMode] = useState<"page" | "width">("page");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Measure the available viewport so we can fit the page perfectly
  const containerRef = useRef<HTMLDivElement>(null);
  const [fitWidth, setFitWidth] = useState<number>(window.innerWidth);
  const [fitHeight, setFitHeight] = useState<number>(window.innerHeight);

  const measure = useCallback(() => {
    if (containerRef.current) {
      // Leave room for the thin top bar (48px)
      setFitWidth(containerRef.current.clientWidth);
      setFitHeight(containerRef.current.clientHeight);
    }
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setPageNumber((p) => Math.min(p + 1, numPages || 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setPageNumber((p) => Math.max(p - 1, 1));
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [numPages, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  // Remember the last page per PDF during a gig/session.
  useEffect(() => {
    if (!numPages) return;
    try { window.localStorage.setItem(pageKey, String(pageNumber)); } catch {}
  }, [numPages, pageKey, pageNumber]);


  const canPrev = pageNumber > 1;
  const canNext = pageNumber < numPages;
  const isMultiPage = numPages > 1;

  return (
    /* Full-bleed overlay — sits above everything */
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col"
      style={{ touchAction: "manipulation" }}
    >
      {/* ── Top bar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/80 backdrop-blur-sm shrink-0 h-12">
        <span className="text-white/90 font-semibold text-sm truncate max-w-[55vw]">{songTitle}</span>

        <div className="flex items-center gap-3">
          {/* Page indicator — only show for multi-page */}
          {isMultiPage && (
            <span className="text-white/60 text-xs tabular-nums">
              {pageNumber} / {numPages}
            </span>
          )}

          <button
            onClick={() => setFitMode((mode) => mode === "page" ? "width" : "page")}
            className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/80 text-xs transition-colors"
            title="Toggle fit mode"
          >
            {fitMode === "page" ? "Fit page" : "Fit width"}
          </button>

          {/* Open in new tab fallback */}
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/50 hover:text-white/80 transition-colors"
            title="Open PDF in browser"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* Close */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Close sheet music"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* ── PDF stage area ───────────────────────────────── */}
      <div ref={containerRef} className={`flex-1 relative flex items-center justify-center ${fitMode === "width" ? "overflow-y-auto overflow-x-hidden" : "overflow-hidden"}`}>

        {/* Loading spinner */}
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Loader2 className="w-10 h-10 animate-spin text-white/60" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center justify-center gap-4 text-white/70 p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400" />
            <p className="text-sm">{error}</p>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
              <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors">
                Open PDF directly ↗
              </button>
            </a>
          </div>
        )}

        {/* PDF document — fills the container */}
        {!error && (
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages: n }) => {
              setNumPages(n);
              setPageNumber((p) => Math.min(Math.max(p, 1), n));
              setLoading(false);
            }}
            onLoadError={(err) => {
              setError("Could not load PDF. " + err.message);
              setLoading(false);
            }}
            loading=""
            className="flex items-center justify-center w-full h-full"
          >
            <Page
              pageNumber={pageNumber}
              width={fitMode === "width" ? Math.max(320, fitWidth - 24) : fitWidth}
              height={fitMode === "page" ? fitHeight : undefined}
              className="shadow-2xl"
              loading={<div style={{ width: fitWidth, height: fitHeight }} />}
            />
          </Document>
        )}

        {/* ── Prev tap zone (left 25% of screen) ───────── */}
        {isMultiPage && (
          <button
            onClick={() => setPageNumber((p) => Math.max(p - 1, 1))}
            disabled={!canPrev}
            aria-label="Previous page"
            className={`absolute left-0 top-0 h-full w-1/4 flex items-center justify-start pl-3
              transition-opacity
              ${canPrev
                ? "opacity-0 hover:opacity-100 active:opacity-100 focus:opacity-100"
                : "opacity-0 pointer-events-none"
              }`}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <div className="w-12 h-16 rounded-xl bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <ChevronLeft className="w-7 h-7 text-white" />
            </div>
          </button>
        )}

        {/* ── Next tap zone (right 25% of screen) ──────── */}
        {isMultiPage && (
          <button
            onClick={() => setPageNumber((p) => Math.min(p + 1, numPages))}
            disabled={!canNext}
            aria-label="Next page"
            className={`absolute right-0 top-0 h-full w-1/4 flex items-center justify-end pr-3
              transition-opacity
              ${canNext
                ? "opacity-0 hover:opacity-100 active:opacity-100 focus:opacity-100"
                : "opacity-0 pointer-events-none"
              }`}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <div className="w-12 h-16 rounded-xl bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <ChevronRight className="w-7 h-7 text-white" />
            </div>
          </button>
        )}

        {/* ── Always-visible page-turn buttons for multi-page (bottom center) ── */}
        {isMultiPage && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
            <button
              onClick={() => setPageNumber((p) => Math.max(p - 1, 1))}
              disabled={!canPrev}
              aria-label="Previous page"
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all
                bg-black/60 backdrop-blur-sm border border-white/20
                ${canPrev
                  ? "text-white active:scale-95"
                  : "text-white/20 pointer-events-none"
                }`}
            >
              <ChevronLeft className="w-7 h-7" />
            </button>

            <span className="text-white/70 text-sm tabular-nums font-medium px-3 py-1.5 bg-black/40 rounded-full">
              {pageNumber} / {numPages}
            </span>

            <button
              onClick={() => setPageNumber((p) => Math.min(p + 1, numPages))}
              disabled={!canNext}
              aria-label="Next page"
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all
                bg-black/60 backdrop-blur-sm border border-white/20
                ${canNext
                  ? "text-white active:scale-95"
                  : "text-white/20 pointer-events-none"
                }`}
            >
              <ChevronRight className="w-7 h-7" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
