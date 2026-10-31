# Museum for Luka — Game Vision (V2)

## Purpose

Create a cozy fossil-discovery and museum-building game for Luka, age six. The game should encourage curiosity about ancient life through exploration, excavation, assembling finds, and displaying them in a growing museum.

V2 is a clean project that carries forward proven gameplay and product decisions from V1 while improving the visual presentation and correcting V1's structural pain points. Do not copy V1 wholesale or attempt to build the whole long-term game in one pass.

## Player experience

The player should feel like a young explorer who finds interesting remains, carefully uncovers and cleans them, learns what they found, and sees the museum come to life as a result.

The play rhythm should be calm, clear, and rewarding:

1. Explore a readable space and find where to investigate.
2. Excavate in short, satisfying actions with visible progress.
3. Clean a discovery through a forgiving activity.
4. Collect and, when appropriate, assemble its parts.
5. Display the find and receive a short, child-friendly explanation or fun fact.
6. See progress in the museum and get a clear next goal.

The player should be able to learn by doing. Avoid relying on long instructions or adult reading support.

## Audience and accessibility

- Primary player: Luka, age six.
- Player-facing text is Serbian Cyrillic.
- Use short sentences, familiar words, large readable UI, clear visual feedback, and forgiving interaction ranges.
- Avoid time pressure, harsh failure states, irreversible mistakes, and penalties for experimentation.
- Ensure keyboard movement and mouse activities do not fight each other.
- Keep important objects visually distinct and readable at the chosen camera distance.
- Test the game with Luka when a feature depends on child comprehension or enjoyment; automated tests cannot establish that on their own.

## Visual direction

The three visual references have distinct roles:

- [digging-master-reference.png](references/digging-master-reference.png) is the primary reference for rendering style: bright, stylized low-poly 3D with an angled view, readable fossil displays, and simple characters. It takes precedence for rendering choices.
- [museum-layout.png](references/museum-layout.png) shows the current V1 appearance. It is the baseline and starting point for visual improvement.
- [target-state.png](references/target-state.png) is a secondary concept reference for a bright, welcoming museum and exhibit details. Its hand-illustrated rendering is not the required 3D style. Translate useful exhibit details into the primary reference's low-poly 3D style, with soft shadows, clear silhouettes, and a colorful but controlled palette.

Reference-file availability: all three images are present at the paths above as of 2026-10-04. The earlier target filename mismatch is resolved; this documentation update does not rename or alter any assets.

The museum should feel like a welcoming place to explore: readable fossil displays, distinctive plinths/backdrops, small plaques, plants or benches where they help the room feel lived-in, and a clear visual hierarchy. Design details must not obscure routes, controls, or the fossils.

Avoid pixel-art rendering, harsh realism, frightening imagery, visual clutter, and tiny text. Follow each reference's role without requiring every depicted object to be reproduced. Reference text, depicted species, exhibit counts, and UI values do not override confirmed V2 language, theme, or scope decisions.

### Visual acceptance questions

For each representative scene, check:

- Does it read clearly at actual gameplay scale?
- Can a child distinguish the player, an interactable, and a display at a glance?
- Is the focal exhibit easy to notice without overwhelming the rest of the room?
- Do the rendering, angled view, readable fossil displays, and simple characters follow the bright, stylized low-poly 3D direction of `digging-master-reference.png`?
- Do museum atmosphere and exhibit details draw usefully from `target-state.png` while retaining the primary reference's 3D rendering style?
- Does the scene show a clear visual improvement over the V1 baseline in `museum-layout.png`?
- Does decoration leave walking and interaction space clear?

## Product and content direction

- Make discovery and learning central to the game.
- Each exhibit should have a concise description and at least one child-friendly interesting fact when completed.
- Add occasional simple facts during exploration only when they support the play flow.
- Keep the long-term collection substantial enough to support extended exploration; do not lock the final exhibit count or museum scope without an explicit decision.
- The first planned museum focuses on prehistoric life before the dinosaurs. Dinosaur/fossil and Ice Age content are known future directions; their sequence, size, and release scope remain to be decided.
- Use scientifically grounded names and facts. Keep playful flavor clearly separate from factual claims, and flag content that needs research.

## Proven V1 gameplay to preserve unless changed explicitly

- Movement through a fixed-angle, readable 3D world.
- Digging progress that persists when an action is interrupted.
- A cleaning activity that remembers cleaned areas and cannot damage a fossil through mistakes.
- Forgiving fossil assembly, including a simple alternative to drag-and-drop.
- Partial finds visible in the museum as parts are placed.
- Completed-exhibit cards and clear progress feedback.
- Clear room/site transitions and a satisfying completion state for an excavation site.
- Economy and visitor mechanics may return, but balance values and timing are open for V2.

## Technical direction

- Use Babylon.js and TypeScript, with Vite for local development. V1 proves this stack can support the intended browser game.
- Keep V2 browser-based and local-first initially. No backend, account, or cloud save is required for the first playable version.
- Separate gameplay rules and content from scene presentation and DOM UI where that reduces coupling.
- Define specimens, anatomy groups, exhibits, and sites as reusable data where practical rather than adding per-species special cases throughout the code.
- Keep the save contract explicit, versioned, and as small as the implemented game requires.
- Use tests for important mechanics, progression, reward uniqueness, and save/load behavior. Run visual/browser checks for scene, controls, and UI changes.

## Collaboration and delivery

- Miloš owns product decisions and QA. Codex implements bounded tasks, reports what changed, and runs relevant checks. Luka's play sessions provide feedback on clarity and enjoyment.
- Work in small, playable increments with screenshots or browser evidence for visual changes.
- Before coding a feature, state its player flow and acceptance criteria. After coding, report tests/build results and manual QA steps.
- Preserve confirmed behavior and rewards. Do not silently expand scope, alter balance, or treat a suggestion as an approved requirement.
- If a product decision materially affects future work, record it in `decisions.md` before implementing dependent systems.
