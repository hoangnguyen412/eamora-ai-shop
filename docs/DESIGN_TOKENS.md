# Design Tokens

The values below are the shared visual foundation for the storefront. CSS custom properties in `src/app/globals.css` are the source of truth.

## Color

| Token | Light theme value | Use |
| --- | --- | --- |
| `--background` | `oklch(0.985 0.002 247)` | Page background |
| `--foreground` | `oklch(0.145 0.005 265)` | Primary text |
| `--card` | `oklch(1 0 0)` | Raised content surfaces |
| `--primary` | `oklch(0.488 0.243 264.376)` | Primary actions and links |
| `--secondary` | `oklch(0.96 0.01 264)` | Secondary controls |
| `--muted` | `oklch(0.96 0.008 264)` | Quiet surfaces |
| `--accent` | `oklch(0.95 0.02 264)` | Hover and selected surfaces |
| `--destructive` | `oklch(0.577 0.245 27.325)` | Destructive actions |
| `--success` | `oklch(0.6 0.2 145)` | Positive status |
| `--warning` | `oklch(0.75 0.18 65)` | Caution status |
| `--info` | `oklch(0.6 0.19 250)` | Informational status |
| `--border` | `oklch(0.91 0.01 264)` | Dividers and outlines |

Dark mode uses the corresponding values in the `.dark` selector.

## Typography

- Font family: Inter, loaded through `next/font/google` in `src/app/layout.tsx`.
- Display: 32px / 40px, bold.
- Page title: 24px / 32px, bold; use 30px on wide product-detail layouts when needed.
- Section title: 20px / 28px, semibold.
- Body: 16px / 24px, regular.
- Supporting text: 14px / 20px; compact labels: 12px / 16px.

## Shape And Spacing

- Base radius: 8px (`--radius: 0.5rem`). Component utilities derive smaller and larger radii from this base.
- Spacing follows Tailwind's 4px-based scale: `1` = 4px, `2` = 8px, `3` = 12px, `4` = 16px, `6` = 24px, `8` = 32px, `12` = 48px.
- Borders use `--border`; keyboard focus uses `--ring` with a visible ring.

## Components

- Use the shared primitives in `src/components/ui` for buttons, badges, cards, inputs, selects, tabs, and other controls.
- Use semantic variants rather than one-off colors: primary, secondary, outline, ghost, destructive, and link.
- Preview the current tokens and shared components at `/styleguide`.