# Demo Frontend Theme Colors

Theme palette used by the demo/operator UI:

- Source CSS: `apps/demo-frontend/public/styles.css`
- Structured palette JSON: `apps/demo-frontend/public/theme-colors.json`
- Runtime theme toggle: `apps/demo-frontend/public/app.js` (`dark/light`, persisted in `localStorage` key `mla.demoFrontend.themeMode`)

## Primary Theme Colors

| Name | Value | Source |
| --- | --- | --- |
| Background | `#07161a` | `--bg-0` |
| Foreground | `#e6f3f0` | `--text` |
| Primary | `#2ec4b6` | `--accent-2` |
| Primary Foreground | `#051316` | `--button-primary-fg` |

## Secondary & Accent Colors

| Name | Value | Source |
| --- | --- | --- |
| Secondary | `#0f2229` | `--bg-1` |
| Secondary Foreground | `#96b3ac` | `--muted` |
| Accent | `#ff9f43` | `--accent` |
| Accent Foreground | `#07161a` | `--button-muted-fg` |

## UI Component Colors

| Name | Value | Source |
| --- | --- | --- |
| Card | `rgba(15, 34, 41, 0.78)` | `--card` |
| Card Foreground | `#e6f3f0` | `--text` |
| Popover | `rgba(7, 22, 26, 0.5)` | panel/meta blocks |
| Popover Foreground | `#f3fdfa` | `--heading` |
| Muted | `rgba(125, 159, 168, 0.22)` | neutral status chip background |
| Muted Foreground | `#c8dee1` | `--status-neutral-fg` |

## Utility & Form Colors

| Name | Value | Source |
| --- | --- | --- |
| Border | `rgba(230, 243, 240, 0.16)` | `--border` |
| Input | `rgba(7, 22, 26, 0.68)` | input/select/textarea background |
| Ring | `#2ec4b6` | `--accent-2` |

## Status & Feedback Colors

| Name | Value | Source |
| --- | --- | --- |
| Destructive | `#ff6b6b` | `--warn` |
| Destructive Foreground | `#3b0a0a` | `--button-warn-fg` |
| Success | `#00c853` | `--ok` |
| Success Foreground | `#7dffc8` | `--status-ok-fg` |
| Warning | `#ff9f43` | `--accent` |
| Warning Foreground | `#ffd9b0` | warning hint text |
