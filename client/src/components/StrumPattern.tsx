// Renders a visual strumming pattern from text like "D DU UDU"
export function StrumPattern({ pattern }: { pattern: string }) {
  // Extract just the stroke letters from patterns like "D DU UDU (description)"
  const match = pattern.match(/^([DUdu\s]+)/);
  if (!match) return <span className="text-muted-foreground text-xs">{pattern}</span>;

  const strokes = match[1].trim().replace(/\s+/g, " ").split("");
  const valid = strokes.filter((c) => "DUdu".includes(c));

  if (valid.length === 0) return <span className="text-muted-foreground text-xs">{pattern}</span>;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {valid.map((s, i) => (
        <span key={i} className={`strum-char strum-${s}`}>
          {s.toUpperCase() === "D" ? "↓" : "↑"}
        </span>
      ))}
      {pattern.includes("(") && (
        <span className="text-muted-foreground text-xs ml-1">
          {pattern.match(/\(([^)]+)\)/)?.[1]}
        </span>
      )}
    </div>
  );
}
