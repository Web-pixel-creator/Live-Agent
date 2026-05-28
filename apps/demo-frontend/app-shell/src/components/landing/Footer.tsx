import { Lozenge } from "./Lozenge";

/**
 * Footer — narrow meta band in the dashboard idiom. Hairline top
 * border, mono uppercase columns, brand mark on the left, status
 * lozenge on the right. Quiet, operator-grade.
 */
export const Footer = () => (
  <footer className="relative pt-16 pb-12 border-t border-primary/15">
    <div className="container-narrow">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div className="flex items-center gap-3">
          <div className="relative h-6 w-6">
            <div className="absolute inset-0 rounded-[4px] bg-primary/80" />
            <div className="absolute inset-[3px] rounded-[2px] bg-background flex items-center justify-center">
              <div className="h-1 w-1 rounded-full bg-primary animate-pulse-glow" />
            </div>
          </div>
          <span className="font-serif text-base tracking-tight text-foreground/95">
            AI Action Desk
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/90 ml-2">
            v0.1
          </span>
        </div>

        <nav className="flex flex-wrap items-center gap-x-8 gap-y-3 font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/90">
          {["architecture", "operator guide", "privacy", "github"].map((l) => (
            <a key={l} href="#" className="hover:text-foreground transition-colors duration-200">
              {l}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Lozenge tone="primary">
            <span className="inline-block h-1 w-1 rounded-full bg-primary animate-pulse-glow mr-1.5" />
            system · live
          </Lozenge>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/90">
            © 2026 · gemini multimodal
          </span>
        </div>
      </div>
    </div>
  </footer>
);
