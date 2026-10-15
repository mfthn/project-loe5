# Frontend Development Rules

## Design Consistency
- Read `DESIGN.md` before creating or modifying frontend UI.
- Treat `DESIGN.md` as the single source of truth for visual design.
- Reuse existing components, design tokens, and layout patterns.
- Do not introduce arbitrary colors, font sizes, spacing, shadows, or border radii.
- Maintain consistent visual hierarchy across all pages.

## Implementation
- Inspect the existing project structure before changing files.
- Prefer reusable, modular components over duplicated UI code.
- Preserve existing functionality when improving the design.
- Make every page responsive across desktop, tablet, and mobile.
- Include appropriate loading, empty, error, hover, focus, and disabled states where relevant.

## Verification
- Run the application and inspect the actual rendered UI when possible.
- Compare the implementation with the provided design references.
- Fix visible inconsistencies before considering the task complete.
- Report any design requirements that could not be implemented.
