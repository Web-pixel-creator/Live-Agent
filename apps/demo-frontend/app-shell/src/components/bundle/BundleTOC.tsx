import { useEffect, useRef, useState } from "react";

const ITEMS = [
  { id: "timeline", index: "01", label: "Timeline" },
  { id: "decision", index: "02", label: "Decision" },
  { id: "evidence", index: "03", label: "Evidence" },
  { id: "counterfactual", index: "04", label: "Counterfactual" },
] as const;

// Sticky mini-TOC for /bundle/:id.
// - Scroll-spy via IntersectionObserver: highest visible section is active.
// - Progress rail: thin vertical bar to the right of the items, filled in
//   proportion to how far the reader has moved between the top of section 01
//   and the bottom of section 04. Pre-bundle hero and post-bundle signature
//   are intentionally excluded — the rail measures the bundle, not the page.
// Hidden below lg.
export function BundleTOC({
  outcomeTone,
}: {
  outcomeTone?: "mint" | "rose" | "amber";
}) {
  const [active, setActive] = useState<string>(ITEMS[0].id);
  const [progress, setProgress] = useState(0); // 0..1
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sections = ITEMS
      .map((i) => document.getElementById(`bundle-${i.id}`))
      .filter((el): el is HTMLElement => !!el);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const id = visible[0].target.id.replace(/^bundle-/, "");
          setActive(id);
        }
      },
      { rootMargin: "-15% 0px -60% 0px", threshold: 0 }
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  // Scroll-progress: clamp scrollY between top-of-first and bottom-of-last
  // section, then map to 0..1. rAF-throttled to keep paint light.
  useEffect(() => {
    let raf = 0;
    const compute = () => {
      raf = 0;
      const first = document.getElementById(`bundle-${ITEMS[0].id}`);
      const last = document.getElementById(
        `bundle-${ITEMS[ITEMS.length - 1].id}`
      );
      if (!first || !last) return;
      const start = first.getBoundingClientRect().top + window.scrollY;
      const end =
        last.getBoundingClientRect().top + window.scrollY + last.offsetHeight;
      const span = Math.max(end - start - window.innerHeight * 0.4, 1);
      const y = window.scrollY - start + window.innerHeight * 0.2;
      const p = Math.min(1, Math.max(0, y / span));
      setProgress(p);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(`bundle-${id}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 56;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <nav aria-label="Bundle sections" className="hidden lg:block">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/90 mb-4">
        On this page
      </div>

      {/* Items + progress rail share a flex row. The rail is 1px wide,
          spans the full height of the list, and renders the fill via a
          scaleY transform anchored to the top. */}
      <div className="flex items-stretch gap-4">
        <ul className="flex flex-col gap-1.5">
          {ITEMS.map((item) => {
            const isActive = active === item.id;
            // Active index inherits the case's outcome tone when present;
            // otherwise falls back to the workspace violet accent.
            const accentTone = outcomeTone ?? "violet";
            return (
              <li key={item.id}>
                <a
                  href={`#bundle-${item.id}`}
                  onClick={(e) => handleClick(e, item.id)}
                  className="group flex items-baseline gap-3 py-1 transition-colors"
                >
                  <span
                    className="font-mono text-[10.5px] tabular-nums transition-colors"
                    style={
                      isActive
                        ? { color: `hsl(var(--tint-${accentTone}-fg))` }
                        : undefined
                    }
                  >
                    <span
                      className={
                        isActive
                          ? ""
                          : "text-muted-foreground/90 group-hover:text-muted-foreground"
                      }
                    >
                      {item.index}
                    </span>
                  </span>
                  <span
                    className={`text-[12px] transition-colors ${
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground/90 group-hover:text-foreground/90"
                    }`}
                  >
                    {item.label}
                  </span>
                  {/* Tone-dot on Decision — quiet echo of outcomeTone, so
                      the TOC item visually previews where the case lands. */}
                  {item.id === "decision" && outcomeTone && (
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full ring-1 ring-inset"
                      style={{
                        backgroundColor: `hsl(var(--tint-${outcomeTone}-fg))`,
                        ["--tw-ring-color" as any]: `hsl(var(--tint-${outcomeTone}-fg) / 0.35)`,
                      }}
                    />
                  )}
                </a>
              </li>
            );
          })}
        </ul>

        <div
          ref={railRef}
          aria-hidden
          className="relative w-px self-stretch bg-border/50"
        >
          <div
            className="absolute inset-x-0 top-0 origin-top transition-transform duration-150 ease-out"
            style={{
              height: "100%",
              transform: `scaleY(${progress})`,
              backgroundColor: `hsl(var(--tint-${outcomeTone ?? "violet"}-fg))`,
            }}
          />
        </div>
      </div>
    </nav>
  );
}
