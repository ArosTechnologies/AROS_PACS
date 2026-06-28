---
name: Clinical Precision
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434654'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737685'
  outline-variant: '#c3c6d6'
  surface-tint: '#0c56d0'
  primary: '#003d9b'
  on-primary: '#ffffff'
  primary-container: '#0052cc'
  on-primary-container: '#c4d2ff'
  inverse-primary: '#b2c5ff'
  secondary: '#006a65'
  on-secondary: '#ffffff'
  secondary-container: '#6ff7ee'
  on-secondary-container: '#00716b'
  tertiary: '#7b2600'
  on-tertiary: '#ffffff'
  tertiary-container: '#a33500'
  on-tertiary-container: '#ffc6b2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b2c5ff'
  on-primary-fixed: '#001848'
  on-primary-fixed-variant: '#0040a2'
  secondary-fixed: '#6ff7ee'
  secondary-fixed-dim: '#4edbd2'
  on-secondary-fixed: '#00201e'
  on-secondary-fixed-variant: '#00504c'
  tertiary-fixed: '#ffdbcf'
  tertiary-fixed-dim: '#ffb59b'
  on-tertiary-fixed: '#380d00'
  on-tertiary-fixed-variant: '#812800'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max: 1440px
---

## Brand & Style
The design system moves away from the dark, cybernetic aesthetic toward a **Vibrant Clinical** identity. It prioritizes extreme legibility, surgical precision, and professional energy. The target audience includes medical professionals, lab technicians, and healthcare administrators who require high-density information display without the gloom of traditional enterprise software.

The style is a hybrid of **Minimalism** and **High-Contrast Modernism**. It utilizes a strict modular grid, 0px border radii, and a high-energy primary blue to signal action and reliability. The interface should feel like a high-end medical instrument: sterile but powerful, clean but vibrant, and above all, absolutely precise.

## Colors
The palette is rooted in a "Clinical White" environment to maximize perceived cleanliness and focus.

- **Primary (Medical Blue):** `#0052CC` is the core action color. Use it for primary buttons, active states, and critical navigation markers.
- **Secondary (Soft Teal):** `#00B5AD` provides a calming, modern-medical accent. Use it for success states, progress indicators, and data visualization highlights.
- **Clinical Grays:** A range of cool-toned grays (from `#0F172A` for text to `#F1F5F9` for subtle backgrounds) ensures structural hierarchy without the harshness of pure black.
- **Semantic Colors:** Use a vibrant red (`#D32F2F`) for alerts and a crisp amber (`#ED8936`) for warnings, ensuring they pop against the clinical blue/teal base.

## Typography
This design system utilizes **Inter** for its exceptional legibility in data-dense environments. The switch from monospaced to this premium sans-serif improves accessibility while maintaining a "technical" feel through tighter letter spacing in headlines and generous line heights in body text.

Use `headline-xl` sparingly for dashboard summaries. `label-md` should be used for table headers and section titles to maintain the structured, modular feel. All text should utilize high-contrast pairings against the background to meet AAA accessibility standards where possible.

## Layout & Spacing
The layout follows a **Fixed-Grid** philosophy for desktop to ensure data visualization remains predictable and "locked-in." 

- **Grid:** A 12-column grid system with 16px gutters.
- **Rhythm:** An 8px base unit (2x the 4px spacing unit) governs all vertical rhythm.
- **Modular Blocks:** Content is housed in "Specimen Cards"—sharp-edged containers that stack vertically on mobile and span grid columns on desktop. 
- **Density:** High-density spacing is preferred. Use tight padding (8px or 12px) for data tables and list items to maximize the information visible on a single screen.

## Elevation & Depth
This design system rejects shadows in favor of **Tonal Layers** and **Sharp Outlines**. 

- **Surface Levels:** The base background is light gray (`#F8FAFC`). Primary containers use a pure white (`#FFFFFF`) background.
- **Borders:** Depth is communicated through 1px solid borders. Use `#E2E8F0` for standard containers and the Primary Medical Blue for active or focused elements.
- **Stacking:** Modals and dropdowns do not use blurs. Instead, they use a thicker 2px border and a subtle neutral overlay (`rgba(15, 23, 42, 0.4)`) to dim the background, keeping the focus entirely on the sharp, rectangular window.

## Shapes
The shape language is strictly **Sharp**. 

All buttons, inputs, cards, and tags must have a 0px border radius. This reinforces the "Precise" identity, suggesting accuracy, efficiency, and a lack of decorative fluff. The only exception is for circular status dots (e.g., "Live" indicators), which should remain perfect circles to distinguish them from actionable UI elements.

## Components
- **Buttons:** Large, 0px radius blocks. Primary buttons use Medical Blue with white text. Secondary buttons use a 1px Blue border with no fill.
- **Inputs:** Square-edged fields with a 1px gray border. On focus, the border thickens to 2px Primary Blue. Labels are always positioned above the field in `label-md` style.
- **Data Tables:** The heart of the system. Use alternate row striping in a very faint blue (`#F0F7FF`). Headers are sticky with a solid 2px bottom border.
- **Status Chips:** Small rectangular boxes with 0px radius. Use the Secondary Teal for "Healthy/Normal" and Medical Blue for "Scheduled/Active."
- **Progress Bars:** Flat, 2D bars without rounded caps. Use a neutral gray background with a Primary Blue or Secondary Teal fill.
- **Cards:** No shadows. Defined solely by 1px `#E2E8F0` borders. Use for grouping patient data or lab results.