# BreakBase Design System

## Clean Light + Coinbase Blue (#0052ff)

---

## 1. Color Palette

### Backgrounds

| Token              | Value                    | Usage                            |
| ------------------ | ------------------------ | -------------------------------- |
| `--bg-primary`     | `#FFFFFF`                | Page background                  |
| `--bg-elevated`    | `#F9FAFB`                | Elevated sections                |
| `--bg-surface-1`   | `#FFFFFF`                | Card backgrounds                 |
| `--bg-surface-2`   | `#F3F4F6`                | Input fields, wells              |
| `--bg-surface-3`   | `#EEF0F3`                | Deeper wells                     |
| `--bg-section-alt` | `#F5F8FF`                | Alternating sections (blue wash) |
| `--bg-nav`         | `rgba(255,255,255,0.85)` | Nav background (scrolled)        |
| `--bg-nav-top`     | `transparent`            | Nav background (top)             |

### Text

| Token               | Value     | Usage                   |
| ------------------- | --------- | ----------------------- |
| `--text-primary`    | `#0A0B0D` | Headings, high-emphasis |
| `--text-secondary`  | `#4B5563` | Body text               |
| `--text-tertiary`   | `#9CA3AF` | Captions, hints         |
| `--text-quaternary` | `#D1D5DB` | Placeholders            |
| `--text-on-accent`  | `#FFFFFF` | Text on blue buttons    |

### Accent (Coinbase Blue)

| Token                 | Value                 | Usage                    |
| --------------------- | --------------------- | ------------------------ |
| `--accent-primary`    | `#0052FF`             | Primary CTA, focus rings |
| `--accent-hover`      | `#3377FF`             | Button hover             |
| `--accent-pressed`    | `#0043CC`             | Button pressed           |
| `--accent-subtle`     | `rgba(0,82,255,0.08)` | Tinted backgrounds       |
| `--accent-link`       | `#0052FF`             | Links                    |
| `--accent-link-hover` | `#3377FF`             | Link hover               |

### Borders & Dividers

| Token                | Value                | Usage            |
| -------------------- | -------------------- | ---------------- |
| `--border-primary`   | `rgba(0,0,0,0.08)`   | Card borders     |
| `--border-secondary` | `rgba(0,0,0,0.12)`   | Input borders    |
| `--border-hover`     | `rgba(0,0,0,0.16)`   | Hover borders    |
| `--border-accent`    | `rgba(0,82,255,0.4)` | Focus/active     |
| `--divider`          | `#E5E7EB`            | Section dividers |

### Status

| Token                     | Value                   | Usage          |
| ------------------------- | ----------------------- | -------------- |
| `--status-success`        | `#098551`               | Defended       |
| `--status-success-subtle` | `rgba(9,133,81,0.08)`   | Success bg     |
| `--status-danger`         | `#CF202F`               | Broken, errors |
| `--status-danger-subtle`  | `rgba(207,32,47,0.08)`  | Error bg       |
| `--status-warning`        | `#ED702F`               | Warning        |
| `--status-warning-subtle` | `rgba(237,112,47,0.08)` | Warning bg     |

---

## 2. Typography

### Font Family

```css
--font-display: 'Inter Variable', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'SF Mono', 'Fira Code', ui-monospace, monospace;
```

Use `font-feature-settings: 'cv01', 'cv02', 'cv03', 'cv04'` on Inter.

### Scale

| Token         | Size | Weight | Line Height | Letter Spacing | Usage            |
| ------------- | ---- | ------ | ----------- | -------------- | ---------------- |
| display       | 56px | 600    | 1.07        | -0.02em        | Hero headlines   |
| h1            | 40px | 600    | 1.10        | -0.02em        | Section headings |
| h2            | 28px | 500    | 1.14        | -0.01em        | Feature titles   |
| h3            | 21px | 600    | 1.19        | -0.01em        | Card titles      |
| body          | 17px | 400    | 1.47        | -0.011em       | Reading text     |
| body-emphasis | 17px | 600    | 1.24        | -0.011em       | Labels           |
| caption       | 14px | 400    | 1.43        | 0              | Captions         |
| label         | 12px | 600    | 1.33        | 0.5px          | Uppercase labels |
| micro         | 12px | 400    | 1.33        | 0              | Fine print       |

---

## 3. Cards

### Standard Card

```css
background: #ffffff;
border: 1px solid rgba(0, 0, 0, 0.08);
border-radius: 20px;
box-shadow:
  0 1px 3px rgba(0, 0, 0, 0.08),
  0 1px 2px rgba(0, 0, 0, 0.04);
padding: 24px;
```

No backdrop-filter. No glassmorphism.

### Hover State

```css
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
transform: translateY(-4px);
transition: all 300ms cubic-bezier(0.165, 0.84, 0.44, 1);
```

### Accent Card

```css
background: #f5f8ff;
border: 1px solid rgba(0, 82, 255, 0.15);
border-radius: 20px;
```

### Subtle Card

```css
background: #f9fafb;
border: 1px solid rgba(0, 0, 0, 0.06);
border-radius: 16px;
```

---

## 4. Navigation

```css
position: fixed;
top: 0;
height: 64px;
/* At top */
background: transparent;
border-bottom: none;
/* On scroll */
background: rgba(255, 255, 255, 0.85);
backdrop-filter: blur(20px);
border-bottom: 1px solid rgba(0, 0, 0, 0.06);
transition: all 300ms;
```

Active link indicator: 2px bottom border in `#0052FF`.

---

## 5. Buttons

### Primary (Coinbase Blue Pill)

```css
background: #0052ff;
color: #ffffff;
padding: 8px 20px;
border-radius: 980px;
font-size: 14px;
font-weight: 600;
hover: background #3377ff;
active:
  background #0043cc,
  scale(0.98);
```

### Secondary (Light Pill)

```css
background: transparent;
color: #0a0b0d;
border: 1px solid rgba(0, 0, 0, 0.12);
border-radius: 980px;
hover: background #f3f4f6;
```

### Ghost

```css
background: transparent;
color: #0052ff;
hover: background rgba(0, 82, 255, 0.08);
```

---

## 6. Inputs

```css
background: #f3f4f6;
color: #0a0b0d;
border: 1px solid #e5e7eb;
border-radius: 8px;
padding: 10px 14px;
placeholder: #9ca3af;
focus:
  border-color #0052ff,
  box-shadow 0 0 0 3px rgba(0, 82, 255, 0.12);
```

---

## 7. Badges

```css
padding: 2px 10px;
border-radius: 980px;
font-size: 12px;
font-weight: 600;

/* Variants */
active:    bg rgba(9,133,81,0.10),   color #098551, border rgba(9,133,81,0.20)
resolved:  bg rgba(0,82,255,0.10),   color #0052FF, border rgba(0,82,255,0.20)
expired:   bg rgba(237,112,47,0.10), color #ED702F, border rgba(237,112,47,0.20)
cancelled: bg rgba(207,32,47,0.10),  color #CF202F, border rgba(207,32,47,0.20)
```

---

## 8. Spacing

4px base grid: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px.

| Context                     | Value              |
| --------------------------- | ------------------ |
| Section vertical padding    | 64px (48px mobile) |
| Card internal padding       | 24px               |
| Card grid gap               | 20px               |
| Content max-width           | 1200px             |
| Nav height                  | 64px               |
| Between heading and content | 32px               |

---

## 9. Border Radius

| Context                | Value |
| ---------------------- | ----- |
| Inputs, small cards    | 8px   |
| Feature panels         | 12px  |
| Subtle cards           | 16px  |
| Standard cards, modals | 20px  |
| Buttons, badges, pills | 980px |
| Avatars                | 50%   |

---

## 10. Animations

### Easing

| Name       | Value                                 |
| ---------- | ------------------------------------- |
| entrance   | `cubic-bezier(.165,.84,.44,1)`        |
| default    | `cubic-bezier(0.25, 0.1, 0.25, 1.0)`  |
| spring     | `cubic-bezier(0.34, 1.56, 0.64, 1.0)` |
| decelerate | `cubic-bezier(0.0, 0.0, 0.2, 1.0)`    |

### Durations

| Context          | Duration |
| ---------------- | -------- |
| Button hover     | 150ms    |
| Card hover       | 300ms    |
| Content reveal   | 400ms    |
| Page transition  | 500ms    |
| Scroll animation | 600ms    |

### Content Reveal

```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

Animation: `400ms cubic-bezier(.165,.84,.44,1) both`

### Card Grid Stagger

80ms delay per child.

---

## 11. Tailwind Theme

```css
@theme {
  --color-bg-primary: #ffffff;
  --color-bg-elevated: #f9fafb;
  --color-bg-surface-1: #ffffff;
  --color-bg-surface-2: #f3f4f6;
  --color-bg-surface-3: #eef0f3;
  --color-bg-section-alt: #f5f8ff;
  --color-accent: #0052ff;
  --color-accent-hover: #3377ff;
  --color-accent-pressed: #0043cc;
  --color-accent-subtle: rgba(0, 82, 255, 0.08);
  --color-accent-link: #0052ff;
  --color-accent-link-hover: #3377ff;
  --color-text-primary: #0a0b0d;
  --color-text-secondary: #4b5563;
  --color-text-tertiary: #9ca3af;
  --color-text-quaternary: #d1d5db;
  --color-text-on-accent: #ffffff;
  --color-border-primary: rgba(0, 0, 0, 0.08);
  --color-border-secondary: rgba(0, 0, 0, 0.12);
  --color-border-hover: rgba(0, 0, 0, 0.16);
  --color-border-accent: rgba(0, 82, 255, 0.4);
  --color-divider: #e5e7eb;
  --color-success: #098551;
  --color-success-subtle: rgba(9, 133, 81, 0.08);
  --color-danger: #cf202f;
  --color-danger-subtle: rgba(207, 32, 47, 0.08);
  --color-warning: #ed702f;
  --color-warning-subtle: rgba(237, 112, 47, 0.08);
  --radius-card: 20px;
  --radius-input: 8px;
  --radius-pill: 980px;
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-card-hover: 0 4px 12px rgba(0, 0, 0, 0.1);
  --shadow-modal: 0 24px 80px rgba(0, 0, 0, 0.15);
  --ease-entrance: cubic-bezier(0.165, 0.84, 0.44, 1);
  --ease-default: cubic-bezier(0.25, 0.1, 0.25, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-decelerate: cubic-bezier(0, 0, 0.2, 1);
}
```
