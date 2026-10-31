# Visitor entrance and cashier presentation — 2026-10-30

## Scope and behavior

Miloš requested a front museum entrance, visitors waiting in front of the cashier, a rotated player selling position and visible money piling beside the desk. He selected a **visual pile with immediate ticket credit**.

- An open wooden doorway, Cyrillic **Улаз** sign, threshold and teal mat mark the front edge indicated in the reference screenshot. Visitors appear at its inner threshold and leave through the same entrance.
- Three floor marks lead to the customer side of the existing cashier. Waiting visitors face the desk. Luka's blue selling circle and the register screen face the opposite side. Luka turns toward the counter when standing there; visitor paths avoid his circle.
- A small tray beside the desk fills with gold coins from saved lifetime ticket income. Existing saves reconstruct it from their sales counters. The visible stack caps at 40 coins; the actual balance keeps its normal exact value. Spending does not remove this visual record of ticket sales. It is not collectible money.
- The doorway posts and coin tray participate in furniture collision. The fresh-game starting point moves slightly inward so the foreground doorway does not hide Luka. Both museum sizes use the same entrance/cashier layout.

Schema **19** is unchanged. Immediate saved payment, prices, arrival timing, queue limits, pause rules, tours, purchases, travel and reset retain their existing rules. No dependencies, new income or new collection step.

## Verification

- `npm test`: **160 passed**, including entrance/queue orientation, access to the selling spot, rejection of customer-side selling, routes in both halls and existing transaction/save regressions.
- `npm run build`: **passed**. Existing large JavaScript chunk warning remains.
- `scripts/check-visitors.mjs`: **passed** in disposable **Edge 156.0.4314.50** profiles at **1440 × 1000**, **1280 × 720**, and **390 × 844**, followed by screenshot inspection. A final narrow-screen label-spacing adjustment was checked separately in Edge.

The browser script uses disposable Edge profiles and isolated browser storage. Luka's real save is untouched. It exercises actual keyboard movement to the new selling circle, arrival at the doorway, the three waiting positions, tours, failed payment/retry, reload, travel, capped pile growth, compact/expanded halls, pause behavior, reset and save-slot isolation. The fixture for the compact hall uses actual paid stand receipts, not a partial legacy grant.

## Screenshots

| View | Before | After |
| --- | --- | --- |
| Fresh museum, 1440 × 1000 | [Before](entrance-before-fresh-1440.png) | [Entrance and cashier](entrance-after-fresh-1440.png) |
| Fresh museum, 1280 × 720 | [Before](entrance-before-fresh-1280.png) | [After](entrance-after-fresh-1280.png) |
| Fresh museum, 390 × 844 | [Before](entrance-before-fresh-390.png) | [After](entrance-after-fresh-390.png) |
| Expanded hall queue, 1440 × 1000 | [Before](entrance-before-queue.png) | [Front queue](entrance-after-queue.png) |
| Selling tickets, 1440 × 1000 | [Before](entrance-before-tour-1440.png) | [New serving position and coins](entrance-after-tour-1440.png) |

Additional evidence: [full coin pile](entrance-after-full-pile.png), [visitor arrival](entrance-after-arrival.png), [compact queue](entrance-after-compact-queue-1440.png), [compact queue at 1280](entrance-after-compact-queue-1280.png), [compact queue at 390](entrance-after-compact-queue-390.png).

Visual inspection checks the doorway, player, queue, desk and coin pile against the existing bright low-poly style. The narrow expanded-hall view remains small, as before. These checks do not replace Luka's playtest.

## Changed files

Shared positions and routes: `src/content/visitors.ts`, `src/game/navigation.ts`, `src/game/museum-layout.ts`, `src/game/visitor-simulation.ts`. Scene, labels and saved-income display: `src/presentation/visitors.ts`, `src/presentation/world.ts`, `src/app/prototype.ts`, `src/ui/visitors.ts`, `src/style.css`. Regression coverage: `tests/visitors.test.ts`, `scripts/check-visitors.mjs`. Documentation: this report, `docs/decisions.md`, and the current-update link in `docs/qa/visitors.md`.

To check manually: complete a display, watch visitors arrive at **Улаз**, then stand in the blue circle on the museum side of **Каса**. Confirm they face Luka and coins appear beside the desk as the balance rises. Leave the circle to stop serving, then reload and check that the money display remains.
