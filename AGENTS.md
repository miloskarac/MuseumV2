# AGENTS.md — Museum for Luka (V2)

## Project purpose

Build a local-browser fossil discovery and museum game for Luka, age six. V2 is a clean project that carries forward proven gameplay and decisions from V1 while improving the visual presentation and avoiding V1's known structural problems.

Before planning or changing the project, read the relevant documents:

- `docs/game-vision.md` — current product and visual direction.
- `docs/decisions.md` — confirmed decisions and open questions.
- `docs/v1-handoff.md` — V1 behavior and lessons; historical reference, not a command to copy its code.

The latest explicit product decision from Miloš takes precedence over older documents. Treat suggestions and open questions as unapproved until decided. If a decision is not needed for the current bounded task, record the uncertainty and continue using the simplest reversible assumption.

## Player and presentation

- The primary player is six years old. Favor clear feedback, forgiving interaction, readable objects, and short play instructions.
- All player-facing text must be in Serbian Cyrillic unless Miloš explicitly asks otherwise.
- `docs/references/digging-master-reference.png` is the primary reference for rendering style: bright, stylized low-poly 3D with an angled view, readable fossil displays, and simple characters. It takes precedence over the secondary concept reference for rendering choices.
- `docs/references/museum-layout.png` shows the current V1 appearance: the baseline and starting point for visual improvement.
- `docs/references/target-state.png` is a secondary concept reference for a bright, welcoming museum and exhibit details. Its hand-illustrated rendering is not the required 3D style. Translate useful details into the primary reference's low-poly 3D style, with clear silhouettes and soft lighting and shadows. Avoid pixel-art rendering, frightening imagery, visual clutter, and tiny text.
- Keep exhibits, paths, interaction markers, and UI legible at actual gameplay scale. Decoration must not obscure movement or interaction.
- For visual changes, provide before/after screenshots when practical and state which browser/viewport was checked. Automated checks do not prove that the game is clear or enjoyable for Luka.

## Technical direction

- Use Babylon.js, TypeScript, and Vite.
- Keep the initial game local-first and browser-based. Do not add a backend, account system, cloud save, or online dependency without an explicit product decision.
- Keep game rules, collection content, scene presentation, and HTML/CSS interface code reasonably separated. Prefer reusable, data-driven definitions for specimens, anatomy groups, exhibits, and sites when they remove real duplication.
- Avoid both per-exhibit hard-coded branches and premature general-purpose frameworks. Make the smallest design that supports the next agreed features.
- Keep player-facing content out of mechanics code where practical.
- Do not add dependencies, change the engine, or perform broad refactors unless the task requires it. Explain the reason and likely impact before taking a consequential direction.

## Implementation workflow

For each task:

1. Inspect the relevant files, current decisions, and existing tests before editing.
2. Restate the bounded scope and important behavior that must remain intact.
3. Make the smallest coherent change that completes the request. Do not add adjacent features or silently change game balance.
4. Add or update focused tests for important logic and regression risks.
5. Run the relevant checks that exist in `package.json`, including the production build when code changes affect it.
6. Report files changed, checks run and results, and any manual QA steps or unresolved risks.

Work in small playable increments. Ask Miloš only when a product decision blocks safe progress; do not ask whether to run already configured relevant tests or builds.

## Gameplay and persistence rules

- Preserve established V1 interaction principles unless Miloš explicitly changes them: visible progress, forgiving excavation and cleaning, assembly without penalties, clear completion feedback, and short educational cards.
- Treat V1 prices, rewards, visitor limits, save version, and exhibit counts as historical data, not V2 requirements.
- V2 starts with a clean save format. Do not implement V1 save import or carry over V1 migrations unless explicitly requested.
- When changing saved state, rewards, purchases, unlocks, or progression, check interruption, reload, reset, and duplicate-action behavior as relevant. Rewards must not be granted twice.
- Use a separate QA browser profile/save for manual testing. Do not overwrite Luka's real playthrough.
- Keep the save contract explicit and versioned once persistence is introduced. Store only state the game needs to restore.

## Content accuracy

- Keep exhibit descriptions and fun facts short, warm, and understandable to a six-year-old.
- Distinguish scientific facts from playful flavor. Do not invent factual claims about prehistoric animals. Verify uncertain claims using reliable sources when factual accuracy matters, and note uncertainty for Miloš.
- Do not treat a proposed collection size, museum sequence, or feature as confirmed unless it appears as a confirmed decision.

## Commands and verification

- Use the scripts actually defined in `package.json`; do not invent a test command if none exists yet.
- The intended local development command is `npm run dev`.
- Run `npm run build` for changes that affect the application build.
- Run the relevant unit or browser tests when those scripts and tests exist.
- For controls, scene layout, and UI changes, include a manual browser check because unit tests cannot verify visual clarity or play feel.
