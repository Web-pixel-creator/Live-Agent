# Demo Frontend Theme Colors

Theme palette used by the demo/operator UI (`Violet Bloom`, tweakcn/shadcn style tokens):

- Source CSS: `apps/demo-frontend/public/styles.css`
- Structured palette JSON: `apps/demo-frontend/public/theme-colors.json`
- Runtime theme toggle: `apps/demo-frontend/public/app.js` (`dark/light`, persisted in `localStorage` key `mla.demoFrontend.themeMode`)

## Primary Theme Colors

| Name | Value | Source |
| --- | --- | --- |
| Background | `#0e0f11` | `--background` |
| Foreground | `oklch(0.9551 0 0)` | `--foreground` |
| Primary | `oklch(0.6132 0.2294 291.7437)` | `--primary` |
| Primary Foreground | `oklch(1 0 0)` | `--primary-foreground` |

## Secondary & Accent Colors

| Name | Value | Source |
| --- | --- | --- |
| Secondary | `oklch(0.2940 0.0130 272.9312)` | `--secondary` |
| Secondary Foreground | `oklch(0.9551 0 0)` | `--secondary-foreground` |
| Accent | `oklch(0.2795 0.0368 260.0310)` | `--accent-ui` |
| Accent Foreground | `oklch(0.7857 0.1153 246.6596)` | `--accent-foreground` |

## UI Component Colors

| Name | Value | Source |
| --- | --- | --- |
| Card | `oklch(0.2568 0.0076 274.6528)` | `--card` |
| Card Foreground | `oklch(0.9551 0 0)` | `--card-foreground` |
| Popover | `oklch(0.2568 0.0076 274.6528)` | `--popover` |
| Popover Foreground | `oklch(0.9551 0 0)` | `--popover-foreground` |
| Muted | `oklch(0.2940 0.0130 272.9312)` | `--muted-ui` |
| Muted Foreground | `oklch(0.7058 0 0)` | `--muted-foreground` |

## Utility & Form Colors

| Name | Value | Source |
| --- | --- | --- |
| Border | `oklch(0.3289 0.0092 268.3843)` | `--border` |
| Input | `oklch(0.3289 0.0092 268.3843)` | `--input` |
| Ring | `oklch(0.6132 0.2294 291.7437)` | `--ring` |

## Status & Feedback Colors

| Name | Value | Source |
| --- | --- | --- |
| Destructive | `oklch(0.7106 0.1661 22.2162)` | `--destructive` |
| Destructive Foreground | `oklch(1 0 0)` | `--destructive-foreground` |
| Success | `oklch(0.8003 0.1821 151.7110)` | `--chart-1` |
| Success Foreground | `color-mix(in oklch, var(--chart-1) 78%, white)` | `--status-ok-fg` |
| Warning | `oklch(0.8077 0.1035 19.5706)` | `--chart-3` |
| Warning Foreground | `oklch(0.7857 0.1153 246.6596)` | `--accent-foreground` |
