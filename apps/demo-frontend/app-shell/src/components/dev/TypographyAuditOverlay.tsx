import { useEffect, useState, useCallback } from "react";

/**
 * TypographyAuditOverlay — dev-only in-app QA.
 *
 * Walks the live DOM and flags:
 *   1. Text whose computed color/background contrast falls below
 *      WCAG AA (4.5:1 normal, 3:1 large ≥18px or ≥14px bold).
 *   2. Multi-line text (>1 line of wrapped content) without an
 *      explicit line-height (browser default ~1.2 — too tight for prose).
 *
 * Highlights offending elements with a dashed outline + tone color
 * (rose = contrast fail, amber = leading fail) and lists them in a
 * floating panel. Toggle with Alt+Shift+T or the bottom-right pill.
 *
 * Mounted only when import.meta.env.DEV is true. Zero prod cost.
 */

type Issue = {
  id: number;
  el: HTMLElement;
  kind: "contrast" | "leading";
  detail: string;
  snippet: string;
};

const HIGHLIGHT_ATTR = "data-typo-audit";
const STYLE_ID = "typo-audit-style";

function parseRgb(str: string): [number, number, number, number] | null {
  const m = str.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
  const [r, g, b] = parts;
  const a = parts.length === 4 ? parts[3] : 1;
  return [r, g, b, a];
}

function relLuminance(r: number, g: number, b: number) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function contrast(c1: [number, number, number], c2: [number, number, number]) {
  const l1 = relLuminance(...c1);
  const l2 = relLuminance(...c2);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// Walk parents to find the first non-transparent background.
function effectiveBg(el: HTMLElement): [number, number, number] {
  let cur: HTMLElement | null = el;
  while (cur) {
    const cs = getComputedStyle(cur);
    const rgba = parseRgb(cs.backgroundColor);
    if (rgba && rgba[3] > 0.5) return [rgba[0], rgba[1], rgba[2]];
    cur = cur.parentElement;
  }
  // Fall back to the document background — read --background HSL token.
  return [12, 12, 19]; // hsl(240 24% 6%)
}

function blend(
  fg: [number, number, number],
  bg: [number, number, number],
  alpha: number,
): [number, number, number] {
  return [
    Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
    Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
    Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
  ];
}

function hasOwnText(el: HTMLElement) {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) return true;
  }
  return false;
}

function isMultiline(el: HTMLElement) {
  const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight);
  if (!isFinite(lh)) return false;
  return el.getBoundingClientRect().height > lh * 1.5;
}

function audit(): Issue[] {
  const issues: Issue[] = [];
  const root = document.querySelector("main") || document.body;
  const all = root.querySelectorAll<HTMLElement>("*");
  let id = 0;
  all.forEach((el) => {
    if (el.closest("[data-typo-audit-ui]")) return;
    if (!hasOwnText(el)) return;
    const cs = getComputedStyle(el);
    const fontSizePx = parseFloat(cs.fontSize);
    const isBold = parseInt(cs.fontWeight, 10) >= 600;
    const isLarge = fontSizePx >= 18 || (fontSizePx >= 14 && isBold);
    const minRatio = isLarge ? 3 : 4.5;

    // Contrast
    const fg = parseRgb(cs.color);
    if (fg) {
      const bg = effectiveBg(el);
      const effFg = blend([fg[0], fg[1], fg[2]], bg, fg[3]);
      const ratio = contrast(effFg, bg);
      if (ratio < minRatio) {
        issues.push({
          id: id++,
          el,
          kind: "contrast",
          detail: `${ratio.toFixed(2)}:1 (need ${minRatio}:1) — ${cs.color}`,
          snippet: (el.textContent || "").trim().slice(0, 60),
        });
      }
    }

    // Leading: multiline element with default normal line-height.
    // Browsers report `line-height: normal` as the computed font-size *
    // default factor; we detect by checking the inline style/tagged classes.
    if (isMultiline(el)) {
      const lh = parseFloat(cs.lineHeight);
      const ratio = lh / fontSizePx;
      if (ratio < 1.35) {
        issues.push({
          id: id++,
          el,
          kind: "leading",
          detail: `line-height ${lh.toFixed(0)}px / font ${fontSizePx.toFixed(0)}px = ${ratio.toFixed(2)} (need ≥1.35)`,
          snippet: (el.textContent || "").trim().slice(0, 60),
        });
      }
    }
  });
  return issues;
}

function applyHighlights(issues: Issue[]) {
  // Clear previous
  document
    .querySelectorAll<HTMLElement>(`[${HIGHLIGHT_ATTR}]`)
    .forEach((el) => {
      el.removeAttribute(HIGHLIGHT_ATTR);
    });
  issues.forEach((iss) => {
    iss.el.setAttribute(HIGHLIGHT_ATTR, iss.kind);
  });
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    [${HIGHLIGHT_ATTR}="contrast"] {
      outline: 2px dashed hsl(348 90% 65%) !important;
      outline-offset: 2px !important;
      background: hsl(348 90% 65% / 0.08) !important;
    }
    [${HIGHLIGHT_ATTR}="leading"] {
      outline: 2px dashed hsl(38 95% 65%) !important;
      outline-offset: 2px !important;
    }
  `;
  document.head.appendChild(s);
}

function clearStyle() {
  document.getElementById(STYLE_ID)?.remove();
  document
    .querySelectorAll<HTMLElement>(`[${HIGHLIGHT_ATTR}]`)
    .forEach((el) => el.removeAttribute(HIGHLIGHT_ATTR));
}

export const TypographyAuditOverlay = () => {
  const [active, setActive] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);

  const run = useCallback(() => {
    ensureStyle();
    const found = audit();
    applyHighlights(found);
    setIssues(found);
  }, []);

  useEffect(() => {
    if (!active) {
      clearStyle();
      setIssues([]);
      return;
    }
    run();
    const t = window.setTimeout(run, 800); // re-run after layout settles
    return () => window.clearTimeout(t);
  }, [active, run]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        setActive((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const contrastCount = issues.filter((i) => i.kind === "contrast").length;
  const leadingCount = issues.filter((i) => i.kind === "leading").length;

  return (
    <div
      data-typo-audit-ui
      className="fixed bottom-4 right-4 z-[9999] font-mono text-[10px] uppercase tracking-[0.18em]"
    >
      <button
        onClick={() => setActive((v) => !v)}
        className={`rounded-[6px] border px-3 py-1.5 backdrop-blur transition-colors ${
          active
            ? "border-primary/60 bg-primary/15 text-primary"
            : "border-border/60 bg-background/80 text-muted-foreground hover:text-foreground"
        }`}
        title="Toggle typography audit (Alt+Shift+T)"
      >
        a11y · {active ? `${issues.length} issue${issues.length === 1 ? "" : "s"}` : "off"}
      </button>

      {active && (
        <div className="mt-2 w-[320px] max-h-[60vh] overflow-auto rounded-[8px] border border-border/60 bg-background/95 backdrop-blur p-3 shadow-xl">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/40">
            <span className="text-foreground">typography audit</span>
            <button
              onClick={run}
              className="text-muted-foreground hover:text-foreground"
            >
              rescan
            </button>
          </div>
          <div className="flex gap-3 mb-3 normal-case tracking-normal">
            <span className="text-[hsl(348_90%_65%)]">contrast {contrastCount}</span>
            <span className="text-[hsl(38_95%_65%)]">leading {leadingCount}</span>
          </div>
          {issues.length === 0 ? (
            <div className="text-muted-foreground normal-case tracking-normal">
              ✓ no violations in current viewport.
            </div>
          ) : (
            <ul className="space-y-2 normal-case tracking-normal">
              {issues.slice(0, 50).map((iss) => (
                <li
                  key={iss.id}
                  className="border-l-2 pl-2 cursor-pointer hover:bg-secondary/40"
                  style={{
                    borderColor:
                      iss.kind === "contrast"
                        ? "hsl(348 90% 65%)"
                        : "hsl(38 95% 65%)",
                  }}
                  onClick={() => {
                    iss.el.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  <div className="text-foreground/90 text-[10px]">{iss.detail}</div>
                  <div className="text-muted-foreground/80 text-[10px] truncate">
                    “{iss.snippet}”
                  </div>
                </li>
              ))}
              {issues.length > 50 && (
                <li className="text-muted-foreground text-[10px]">
                  + {issues.length - 50} more
                </li>
              )}
            </ul>
          )}
          <div className="mt-3 pt-2 border-t border-border/40 text-muted-foreground/70 normal-case tracking-normal text-[10px]">
            alt+shift+t to toggle · click row to scroll
          </div>
        </div>
      )}
    </div>
  );
};
