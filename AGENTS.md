# AGENTS.md

## Project Goal

Build a playable top-down 2D pixel-art action prototype based on the core experience in `Wiki/基于核心体验的一句话原型.md`: a timed, chaotic, funny, uncertain store raid where the player quickly steals goods, discovers high-value targets, uses nearby merchandise to fight guards, and earns satisfaction from high-risk high-reward decisions.

## Non-Negotiable Constraints

- Do not modify these two source requirement/reference files:
  - `Wiki/基于核心体验的一句话原型.md`
  - `Wiki/top_down_2d_games.html`
- The playable prototype must be implemented with JavaScript and be directly playable in a browser.
- The visual direction must be 2D pixel art.
- Keep the project GitHub Pages friendly: static files should work without a backend.

## Expected Deliverables

- `docs/GDD.md`: game design document with core mechanics, design rationale, and theoretical basis.
- `docs/GDD_explainer.html`: visual HTML explanation of the GDD.
- `docs/Art_Style_and_Requirements.md`: art style and asset requirements.
- `assets/concept/`: generated concept art for the visual direction.
- `assets/pixel_asset_sheet.svg`: trial pixel-art asset sheet.
- `index.html`, `src/styles.css`, `src/game.js`: playable web prototype.

## Development Notes

- Favor small, readable systems over framework complexity.
- Use canvas for gameplay rendering and deterministic pixel primitives for prototype assets.
- Maintain the core loop: grab goods, manage risk, improvise attacks, survive guards, and escape before time runs out.
- When changing gameplay, update the GDD if the implemented behavior diverges from the design.
- Verify the game locally in a browser after significant frontend changes.

