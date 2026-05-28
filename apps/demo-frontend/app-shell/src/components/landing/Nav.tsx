import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

/**
 * Nav — financial-dashboard top bar. Hairline lavender bottom border,
 * subtle blur, mono uppercase nav links, lozenge-style CTA buttons.
 */
const links = [
  { href: "#workflow", label: "01 · workflow" },
  { href: "#capabilities", label: "02 · capabilities" },
  { href: "#difference", label: "03 · why us" },
  { href: "#safety", label: "04 · safety" },
];

export const Nav = () => (
  <header
    className="fixed top-0 z-50 w-full border-b border-primary/15"
    style={{
      background: "hsl(240 24% 6% / 0.7)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    }}
  >
    <div className="container-narrow flex h-14 items-center justify-between">
      <a href="#" className="flex items-center gap-2.5 group">
        <div className="relative h-6 w-6">
          <div className="absolute inset-0 rounded-[4px] bg-primary/80 group-hover:bg-primary transition-colors duration-200" />
          <div className="absolute inset-[3px] rounded-[2px] bg-background flex items-center justify-center">
            <div className="h-1 w-1 rounded-full bg-primary animate-pulse-glow" />
          </div>
        </div>
        <span className="font-serif text-sm tracking-tight text-foreground/95">AI Action Desk</span>
      </a>

      <nav className="hidden md:flex items-center gap-7">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/90 hover:text-primary transition-colors duration-200"
          >
            {l.label}
          </a>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="hidden sm:inline-flex h-8 rounded-[4px] font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/90 hover:text-foreground hover:bg-secondary/60 border border-primary/15"
        >
          <Link to="/app">open workspace</Link>
        </Button>
        <Button
          size="sm"
          className="h-8 rounded-[4px] bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-[10px] uppercase tracking-[0.2em]"
        >
          book a demo
        </Button>
      </div>
    </div>
  </header>
);
