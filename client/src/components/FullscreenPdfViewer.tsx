/**
 * FullscreenPdfViewer
 *
 * Performer-first sheet music viewer.
 * - Page-turn mode: tap zones, keyboard arrows, and swipe gestures
 * - Scroll mode: continuous vertical score-style reading
 * - Annotation mode: pen/eraser overlay saved separately from the PDF
 * - Works on iPad, iPhone, and desktop browser
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  AlertCircle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eraser,
  ExternalLink,
  Keyboard,
  Loader2,
  Pencil,
  Rows3,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { sbPdfAnnotations, type PdfAnnotationStroke } from "@/lib/supabase";
import { PDF_SHORTCUTS, performanceControlsStore, shouldIgnorePerformanceShortcut } from "@/lib/performanceControls";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface Props {
  pdfUrl: string;
  songTitle: string;
  onClose: () => void;
  initialPage?: number;
  songId?: string;
}

type PdfViewMode = "page" | "scroll";
type FitMode = "page" | "width";
type DrawTool = "pen" | "eraser";

type Point = { x: number; y: number };

const DEFAULT_ASPECT = 0.773; // letter-ish width/height fallback
const ERASER_RADIUS = 0.025;

function clampPage(page: number, numPages: number): number {
  return Math.min(Math.max(page, 1), Math.max(numPages, 1));
}

function makeStrokeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function strokeHitsPoint(stroke: PdfAnnotationStroke, point: Point): boolean {
  const radius = Math.max(ERASER_RADIUS, (stroke.width || 3) / 450);
  return stroke.points.some((p) => distance(p, point) <= radius);
}

function pageStrokes(strokes: PdfAnnotationStroke[], pageNumber: number): PdfAnnotationStroke[] {
  return strokes.filter((stroke) => stroke.page === pageNumber);
}

function getPointerPoint(event: React.PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
    y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1),
  };
}

interface AnnotatedPageProps {
  pageNumber: number;
  width: number;
  height: number;
  strokes: PdfAnnotationStroke[];
  annotationMode: boolean;
  tool: DrawTool;
  color: string;
  strokeWidth: number;
  onAddStroke: (stroke: PdfAnnotationStroke) => void;
  onEraseAt: (pageNumber: number, point: Point) => void;
  onPageLoaded: (pageNumber: number, aspect: number) => void;
  registerPageRef?: (pageNumber: number, element: HTMLDivElement | null) => void;
}

function AnnotatedPdfPage({
  pageNumber,
  width,
  height,
  strokes,
  annotationMode,
  tool,
  color,
  strokeWidth,
  onAddStroke,
  onEraseAt,
  onPageLoaded,
  registerPageRef,
}: AnnotatedPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draftRef = useRef<PdfAnnotationStroke | null>(null);
  const pointerRef = useRef<number | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);

  const drawStrokes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const visibleStrokes = draftRef.current ? [...strokes, draftRef.current] : strokes;
    for (const stroke of visibleStrokes) {
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
      for (const point of stroke.points.slice(1)) {
        ctx.lineTo(point.x * width, point.y * height);
      }
      ctx.stroke();
    }
  }, [height, strokes, width]);

  useEffect(() => {
    drawStrokes();
  }, [drawStrokes, draftVersion]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!annotationMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    event.preventDefault();
    event.stopPropagation();
    const point = getPointerPoint(event, canvas);
    pointerRef.current = event.pointerId;
    canvas.setPointerCapture(event.pointerId);

    if (tool === "eraser") {
      onEraseAt(pageNumber, point);
      return;
    }

    draftRef.current = {
      id: makeStrokeId(),
      page: pageNumber,
      color,
      width: strokeWidth,
      points: [point],
    };
    setDraftVersion((value) => value + 1);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!annotationMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (pointerRef.current !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    const point = getPointerPoint(event, canvas);

    if (tool === "eraser") {
      onEraseAt(pageNumber, point);
      return;
    }

    if (!draftRef.current) return;
    const lastPoint = draftRef.current.points[draftRef.current.points.length - 1];
    if (lastPoint && distance(lastPoint, point) < 0.002) return;
    draftRef.current = {
      ...draftRef.current,
      points: [...draftRef.current.points, point],
    };
    setDraftVersion((value) => value + 1);
  };

  const commitDraft = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerRef.current === event.pointerId && canvasRef.current) {
      try {
        canvasRef.current.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
    }
    pointerRef.current = null;
    const draft = draftRef.current;
    draftRef.current = null;
    setDraftVersion((value) => value + 1);
    if (draft && draft.points.length > 1) onAddStroke(draft);
  };

  return (
    <div
      ref={(element) => registerPageRef?.(pageNumber, element)}
      className="relative mx-auto bg-white shadow-2xl"
      style={{ width, height }}
      data-page-number={pageNumber}
    >
      <Page
        pageNumber={pageNumber}
        width={width}
        className="absolute inset-0"
        onLoadSuccess={(page) => {
          const viewport = page.getViewport({ scale: 1 });
          if (viewport.height > 0) onPageLoaded(pageNumber, viewport.width / viewport.height);
        }}
        loading={<div style={{ width, height }} />}
      />
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 z-10 ${annotationMode ? "cursor-crosshair" : "pointer-events-none"}`}
        style={{
          width,
          height,
          touchAction: annotationMode ? "none" : "auto",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={commitDraft}
        onPointerCancel={commitDraft}
        aria-label={`Annotations for page ${pageNumber}`}
      />
    </div>
  );
}

export function FullscreenPdfViewer({ pdfUrl, songTitle, onClose, initialPage = 1, songId }: Props) {
  const pageKey = `maggie-pdf-last-page:${pdfUrl}`;
  const viewModeKey = "maggie-pdf-view-mode";
  const fitModeKey = "maggie-pdf-fit-mode";

  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(() => {
    try {
      const saved = Number(window.localStorage.getItem(pageKey));
      return Number.isFinite(saved) && saved > 0 ? saved : initialPage;
    } catch {
      return initialPage;
    }
  });
  const [viewMode, setViewMode] = useState<PdfViewMode>(() => {
    try {
      return window.localStorage.getItem(viewModeKey) === "scroll" ? "scroll" : "page";
    } catch {
      return "page";
    }
  });
  const [fitMode, setFitMode] = useState<FitMode>(() => {
    try {
      return window.localStorage.getItem(fitModeKey) === "width" ? "width" : "page";
    } catch {
      return "page";
    }
  });
  const [annotationMode, setAnnotationMode] = useState(false);
  const [tool, setTool] = useState<DrawTool>("pen");
  const [penColor, setPenColor] = useState("#f59e0b");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [strokes, setStrokes] = useState<PdfAnnotationStroke[]>([]);
  const [annotationsLoaded, setAnnotationsLoaded] = useState(false);
  const [annotationMessage, setAnnotationMessage] = useState("");
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [pageAspects, setPageAspects] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const swipeStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [fitWidth, setFitWidth] = useState<number>(window.innerWidth);
  const [fitHeight, setFitHeight] = useState<number>(window.innerHeight);

  const measure = useCallback(() => {
    if (containerRef.current) {
      setFitWidth(containerRef.current.clientWidth);
      setFitHeight(containerRef.current.clientHeight);
    }
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const goPrev = useCallback(() => {
    setPageNumber((page) => clampPage(page - 1, numPages));
  }, [numPages]);

  const goNext = useCallback(() => {
    setPageNumber((page) => clampPage(page + 1, numPages));
  }, [numPages]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (!numPages) return;
    try {
      window.localStorage.setItem(pageKey, String(pageNumber));
    } catch {
      // Ignore private-mode/localStorage restrictions.
    }
  }, [numPages, pageKey, pageNumber]);

  useEffect(() => {
    try {
      window.localStorage.setItem(viewModeKey, viewMode);
      window.localStorage.setItem(fitModeKey, fitMode);
    } catch {
      // Ignore private-mode/localStorage restrictions.
    }
  }, [fitMode, viewMode, viewModeKey, fitModeKey]);

  useEffect(() => {
    let isMounted = true;
    setAnnotationsLoaded(false);
    setAnnotationMessage("");
    if (!songId) {
      setAnnotationsLoaded(true);
      return;
    }

    sbPdfAnnotations
      .get(songId, pdfUrl)
      .then((loaded) => {
        if (!isMounted) return;
        setStrokes(loaded);
        setAnnotationsLoaded(true);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("PDF annotations unavailable", err);
        setAnnotationMessage("Annotations are unavailable until the Supabase annotation migration is applied.");
        setAnnotationsLoaded(true);
      });

    return () => {
      isMounted = false;
    };
  }, [pdfUrl, songId]);

  useEffect(() => {
    if (!annotationsLoaded || !songId) return;
    const timeout = window.setTimeout(() => {
      sbPdfAnnotations
        .save(songId, pdfUrl, strokes)
        .then(() => setAnnotationMessage("Saved"))
        .catch((err) => {
          console.warn("Could not save PDF annotations", err);
          setAnnotationMessage("Could not save annotations");
        });
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [annotationsLoaded, pdfUrl, songId, strokes]);

  const canPrev = pageNumber > 1;
  const canNext = pageNumber < numPages;
  const isMultiPage = numPages > 1;

  const registerPageRef = useCallback((page: number, element: HTMLDivElement | null) => {
    pageRefs.current[page] = element;
  }, []);

  const setAspect = useCallback((page: number, aspect: number) => {
    setPageAspects((current) => (current[page] === aspect ? current : { ...current, [page]: aspect }));
  }, []);

  const displayWidthForPage = useCallback(
    (page: number) => {
      const aspect = pageAspects[page] ?? DEFAULT_ASPECT;
      const maxWidth = Math.max(320, fitWidth - 24);
      if (viewMode === "scroll" || fitMode === "width") return maxWidth;
      return Math.max(280, Math.min(maxWidth, Math.max(320, (fitHeight - 16) * aspect)));
    },
    [fitHeight, fitMode, fitWidth, pageAspects, viewMode],
  );

  const displayHeightForPage = useCallback(
    (page: number, width: number) => {
      const aspect = pageAspects[page] ?? DEFAULT_ASPECT;
      return width / aspect;
    },
    [pageAspects],
  );

  const pageNumbers = useMemo(() => Array.from({ length: numPages }, (_, index) => index + 1), [numPages]);

  const handleAddStroke = useCallback((stroke: PdfAnnotationStroke) => {
    setStrokes((current) => [...current, stroke]);
    setAnnotationMessage("Saving…");
  }, []);

  const handleEraseAt = useCallback((targetPage: number, point: Point) => {
    setStrokes((current) => {
      const next = current.filter((stroke) => stroke.page !== targetPage || !strokeHitsPoint(stroke, point));
      if (next.length !== current.length) setAnnotationMessage("Saving…");
      return next;
    });
  }, []);

  const undoLastStroke = useCallback(() => {
    setStrokes((current) => {
      const pageIndexes = current
        .map((stroke, index) => ({ stroke, index }))
        .filter(({ stroke }) => stroke.page === pageNumber);
      const last = pageIndexes[pageIndexes.length - 1];
      if (!last) return current;
      setAnnotationMessage("Saving…");
      return current.filter((_, index) => index !== last.index);
    });
  }, [pageNumber]);

  const clearCurrentPage = useCallback(() => {
    if (!window.confirm(`Clear all notes on page ${pageNumber}?`)) return;
    setStrokes((current) => current.filter((stroke) => stroke.page !== pageNumber));
    setAnnotationMessage("Saving…");
  }, [pageNumber]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (shouldIgnorePerformanceShortcut(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const shortcutsEnabled = performanceControlsStore.isEnabled();
      const key = event.key;
      const lowerKey = key.toLowerCase();
      const isNextKey = key === "ArrowRight" || key === "PageDown" || key === " " || (viewMode === "page" && key === "ArrowDown");
      const isPrevKey = key === "ArrowLeft" || key === "PageUp" || (viewMode === "page" && key === "ArrowUp");

      if (key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (!shortcutsEnabled) return;

      if (lowerKey === "?" || (key === "/" && event.shiftKey)) {
        event.preventDefault();
        setShowShortcutHelp((value) => !value);
        return;
      }

      if (lowerKey === "f") {
        event.preventDefault();
        setFitMode((mode) => (mode === "page" ? "width" : "page"));
        return;
      }

      if (lowerKey === "v") {
        event.preventDefault();
        setViewMode((mode) => (mode === "page" ? "scroll" : "page"));
        return;
      }

      if (lowerKey === "n") {
        event.preventDefault();
        setAnnotationMode((value) => !value);
        return;
      }

      if (lowerKey === "z") {
        event.preventDefault();
        undoLastStroke();
        return;
      }

      if (annotationMode) return;

      if (isNextKey) {
        event.preventDefault();
        goNext();
      } else if (isPrevKey) {
        event.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [annotationMode, goNext, goPrev, onClose, undoLastStroke, viewMode]);


  const handleScroll = useCallback(() => {
    if (viewMode !== "scroll" || !scrollAreaRef.current) return;
    const scrollRect = scrollAreaRef.current.getBoundingClientRect();
    const anchorY = scrollRect.top + 80;
    let closestPage = pageNumber;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const page of pageNumbers) {
      const element = pageRefs.current[page];
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      const distanceFromAnchor = Math.abs(rect.top - anchorY);
      if (rect.bottom > scrollRect.top && rect.top < scrollRect.bottom && distanceFromAnchor < closestDistance) {
        closestDistance = distanceFromAnchor;
        closestPage = page;
      }
    }

    if (closestPage !== pageNumber) setPageNumber(closestPage);
  }, [pageNumber, pageNumbers, viewMode]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (annotationMode || viewMode !== "page") return;
    swipeStartRef.current = { x: event.clientX, y: event.clientY, time: Date.now() };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (annotationMode || viewMode !== "page" || !swipeStartRef.current) return;
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const elapsed = Date.now() - start.time;
    if (elapsed > 900 || Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    if (dx < 0) goNext();
    if (dx > 0) goPrev();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col"
      style={{ touchAction: annotationMode ? "none" : "manipulation" }}
    >
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-black/85 backdrop-blur-sm shrink-0 min-h-14">
        <div className="min-w-0">
          <span className="block text-white/90 font-semibold text-sm truncate max-w-[42vw] sm:max-w-[50vw]">{songTitle}</span>
          <span className="block text-white/45 text-[11px] truncate">
            {annotationMode ? "Annotation mode — draw with touch, pencil, or mouse" : viewMode === "scroll" ? "Scroll score" : "Tap or swipe to turn pages"}
          </span>
        </div>

        <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-wrap">
          {isMultiPage && (
            <span className="text-white/60 text-xs tabular-nums px-1.5">
              {pageNumber} / {numPages}
            </span>
          )}

          <button
            onClick={() => setViewMode((mode) => (mode === "page" ? "scroll" : "page"))}
            className="px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/85 text-xs transition-colors inline-flex items-center gap-1.5"
            title="Toggle page or scroll mode"
          >
            {viewMode === "page" ? <BookOpen className="w-3.5 h-3.5" /> : <Rows3 className="w-3.5 h-3.5" />}
            {viewMode === "page" ? "Page" : "Scroll"}
          </button>

          <button
            onClick={() => setFitMode((mode) => (mode === "page" ? "width" : "page"))}
            className="px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/85 text-xs transition-colors"
            title="Toggle fit mode"
          >
            {fitMode === "page" ? "Fit page" : "Fit width"}
          </button>

          <button
            onClick={() => setAnnotationMode((value) => !value)}
            className={`px-2.5 py-1.5 rounded-full text-xs transition-colors inline-flex items-center gap-1.5 ${
              annotationMode ? "bg-amber-500 text-black" : "bg-white/10 hover:bg-white/20 text-white/85"
            }`}
            title="Toggle annotation mode"
          >
            <Pencil className="w-3.5 h-3.5" />
            Notes
          </button>

          <button
            onClick={() => setShowShortcutHelp((value) => !value)}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/65 hover:text-white transition-colors"
            title="Show PDF shortcuts"
            aria-label="Show PDF shortcuts"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/65 hover:text-white transition-colors"
            title="Open PDF in browser"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Close sheet music"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {annotationMode && (
        <div className="px-3 py-2 bg-black/75 border-t border-white/10 border-b flex items-center justify-between gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTool("pen")}
              className={`h-9 px-3 rounded-full text-xs inline-flex items-center gap-1.5 ${tool === "pen" ? "bg-white text-black" : "bg-white/10 text-white/80"}`}
            >
              <Pencil className="w-3.5 h-3.5" /> Pen
            </button>
            <button
              onClick={() => setTool("eraser")}
              className={`h-9 px-3 rounded-full text-xs inline-flex items-center gap-1.5 ${tool === "eraser" ? "bg-white text-black" : "bg-white/10 text-white/80"}`}
            >
              <Eraser className="w-3.5 h-3.5" /> Eraser
            </button>
            {(["#f59e0b", "#ef4444", "#2563eb", "#111827"] as const).map((color) => (
              <button
                key={color}
                onClick={() => setPenColor(color)}
                className={`w-8 h-8 rounded-full border-2 ${penColor === color ? "border-white" : "border-white/20"}`}
                style={{ backgroundColor: color }}
                aria-label={`Use ${color} pen`}
              />
            ))}
            <select
              value={strokeWidth}
              onChange={(event) => setStrokeWidth(Number(event.target.value))}
              className="h-9 rounded-full bg-white/10 text-white/85 text-xs px-3 border border-white/10"
              aria-label="Pen width"
            >
              <option value={3}>Fine</option>
              <option value={5}>Medium</option>
              <option value={8}>Bold</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/45 text-xs min-w-[56px] text-right">{annotationMessage}</span>
            <button onClick={undoLastStroke} className="h-9 px-3 rounded-full bg-white/10 text-white/80 text-xs inline-flex items-center gap-1.5">
              <Undo2 className="w-3.5 h-3.5" /> Undo
            </button>
            <button onClick={clearCurrentPage} className="h-9 px-3 rounded-full bg-red-500/20 text-red-100 text-xs inline-flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Clear page
            </button>
          </div>
        </div>
      )}

      {showShortcutHelp && (
        <div className="absolute right-3 top-16 z-[10000] w-[min(92vw,360px)] rounded-2xl border border-white/15 bg-black/90 p-4 shadow-2xl backdrop-blur text-white">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-bold">PDF keyboard / pedal controls</div>
              <div className="text-xs text-white/45">Most Bluetooth page-turners send these same keys.</div>
            </div>
            <button onClick={() => setShowShortcutHelp(false)} className="rounded-full p-1 text-white/60 hover:text-white hover:bg-white/10">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1.5">
            {PDF_SHORTCUTS.map((shortcut) => (
              <div key={shortcut.keys} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 text-xs">
                <span className="font-mono font-bold text-amber-200">{shortcut.keys}</span>
                <span className="text-white/75 text-right">{shortcut.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className={`flex-1 relative ${viewMode === "scroll" ? "overflow-y-auto overflow-x-hidden" : "overflow-hidden flex items-center justify-center"}`}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <div ref={scrollAreaRef} className={viewMode === "scroll" ? "min-h-full w-full py-4 space-y-5" : "w-full h-full flex items-center justify-center"}>
          {loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <Loader2 className="w-10 h-10 animate-spin text-white/60" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center gap-4 text-white/70 p-8 text-center min-h-full">
              <AlertCircle className="w-12 h-12 text-red-400" />
              <p className="text-sm">{error}</p>
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors">
                  Open PDF directly ↗
                </button>
              </a>
            </div>
          )}

          {!error && (
            <Document
              file={pdfUrl}
              onLoadSuccess={({ numPages: loadedPages }) => {
                setNumPages(loadedPages);
                setPageNumber((page) => clampPage(page, loadedPages));
                setLoading(false);
              }}
              onLoadError={(err) => {
                setError("Could not load PDF. " + err.message);
                setLoading(false);
              }}
              loading=""
              className={viewMode === "scroll" ? "w-full" : "flex items-center justify-center w-full h-full"}
            >
              {viewMode === "scroll" ? (
                pageNumbers.map((page) => {
                  const pageWidth = displayWidthForPage(page);
                  const pageHeight = displayHeightForPage(page, pageWidth);
                  return (
                    <AnnotatedPdfPage
                      key={page}
                      pageNumber={page}
                      width={pageWidth}
                      height={pageHeight}
                      strokes={pageStrokes(strokes, page)}
                      annotationMode={annotationMode}
                      tool={tool}
                      color={penColor}
                      strokeWidth={strokeWidth}
                      onAddStroke={handleAddStroke}
                      onEraseAt={handleEraseAt}
                      onPageLoaded={setAspect}
                      registerPageRef={registerPageRef}
                    />
                  );
                })
              ) : (
                (() => {
                  const pageWidth = displayWidthForPage(pageNumber);
                  const pageHeight = displayHeightForPage(pageNumber, pageWidth);
                  return (
                    <AnnotatedPdfPage
                      pageNumber={pageNumber}
                      width={pageWidth}
                      height={pageHeight}
                      strokes={pageStrokes(strokes, pageNumber)}
                      annotationMode={annotationMode}
                      tool={tool}
                      color={penColor}
                      strokeWidth={strokeWidth}
                      onAddStroke={handleAddStroke}
                      onEraseAt={handleEraseAt}
                      onPageLoaded={setAspect}
                    />
                  );
                })()
              )}
            </Document>
          )}
        </div>

        {isMultiPage && viewMode === "page" && !annotationMode && (
          <>
            <button
              onClick={goPrev}
              disabled={!canPrev}
              aria-label="Previous page"
              className={`absolute left-0 top-0 h-full w-1/4 flex items-center justify-start pl-3 transition-opacity ${
                canPrev ? "opacity-0 hover:opacity-100 active:opacity-100 focus:opacity-100" : "opacity-0 pointer-events-none"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <div className="w-12 h-16 rounded-xl bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <ChevronLeft className="w-7 h-7 text-white" />
              </div>
            </button>

            <button
              onClick={goNext}
              disabled={!canNext}
              aria-label="Next page"
              className={`absolute right-0 top-0 h-full w-1/4 flex items-center justify-end pr-3 transition-opacity ${
                canNext ? "opacity-0 hover:opacity-100 active:opacity-100 focus:opacity-100" : "opacity-0 pointer-events-none"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <div className="w-12 h-16 rounded-xl bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <ChevronRight className="w-7 h-7 text-white" />
              </div>
            </button>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
              <button
                onClick={goPrev}
                disabled={!canPrev}
                aria-label="Previous page"
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all bg-black/60 backdrop-blur-sm border border-white/20 ${
                  canPrev ? "text-white active:scale-95" : "text-white/20 pointer-events-none"
                }`}
              >
                <ChevronLeft className="w-7 h-7" />
              </button>

              <span className="text-white/70 text-sm tabular-nums font-medium px-3 py-1.5 bg-black/40 rounded-full">
                {pageNumber} / {numPages}
              </span>

              <button
                onClick={goNext}
                disabled={!canNext}
                aria-label="Next page"
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all bg-black/60 backdrop-blur-sm border border-white/20 ${
                  canNext ? "text-white active:scale-95" : "text-white/20 pointer-events-none"
                }`}
              >
                <ChevronRight className="w-7 h-7" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
