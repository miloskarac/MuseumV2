# Museum exterior — 2026-10-30

## Scope

Miloš requested a plaza (plato), street, bus stop and parking in front of the museum.

The front doorway now opens visually onto a paved plaza. A pale approach meets a pedestrian crossing across the street. A teal shelter, bench, bus pictogram and stationary yellow bus identify the stop. Three marked parking spaces hold two small cars. Low planted beds complete the frontage; the expanded museum adds planting along its wider plaza.

These additions are **scenery**. Indoor movement bounds, the entrance queue, cashier position, ticket income, coin pile, travel and schema 19 are unchanged. The exterior adds no interaction or new save fields. The museum camera is centered farther forward and framed to include the street while retaining its angle and screen-relative controls. Other rooms keep their existing views.

## Verification

- `npm test`: **160 passed, 0 failed**.
- `npm run build`: **passed**; existing large-chunk warning remains.
- `scripts/check-visitors.mjs`: **passed** in disposable **Edge 156.0.4314.50** profiles at **1440 × 1000**, **1280 × 720**, and **390 × 844**. Final screenshots were visually inspected in compact and expanded halls. New assertions verify that the entrance and cashier labels do not overlap at any checked size. Luka's browser profile/save was untouched.

Existing focused browser coverage exercises real keyboard access to the cashier, visitor arrival/queue/tours, payments, failed-write retry, reload, travel, scene rebuild, reset and independent QA storage. The scenery introduces no new game rules that need separate unit tests.

## Before and after

Before images are the verified entrance/cashier screenshots from immediately before this change, on the same day.

| View | Before | After |
| --- | --- | --- |
| Fresh hall, 1440 × 1000 | [Entrance only](entrance-after-fresh-1440.png) | [Plaza and street](plaza-after-fresh-1440.png) |
| Fresh hall, 1280 × 720 | [Before](entrance-after-fresh-1280.png) | [After](plaza-after-fresh-1280.png) |
| Fresh hall, 390 × 844 | [Before](entrance-after-fresh-390.png) | [After](plaza-after-fresh-390.png) |
| Expanded hall | [Before](entrance-after-queue.png) | [After](plaza-after-queue.png) |

Visual review: the entrance approach stays open; parked vehicles and the shelter sit in front of the hall without obscuring the cashier or exhibits. The new street and parking follow the existing bright, simple low-poly materials. Narrow-screen museum detail remains small; Luka's playtest is still needed to judge comfort at the intended window size.

## Files and manual check

- `src/presentation/museum-exterior.ts`: reusable static frontage builder using existing shape/material helpers.
- `src/presentation/world.ts`: museum-only exterior construction and forward camera centering.
- `src/game/museum-layout.ts`: framing for compact and expanded halls; movement bounds unchanged.
- `src/ui/visitors.ts`, `scripts/check-visitors.mjs`: separate the entrance/cashier labels when the wider scene is fitted to a narrow viewport; browser assertions cover both hall sizes.
- `docs/decisions.md`, this report, and `docs/qa/plaza-after-*.png`: scope and evidence.

For owner review, open the museum and inspect the parking, bus shelter, crossing and doorway. Walk to the cashier, serve the queue, then travel away and back. Check the expanded hall as well. The street and plaza are currently decorative; Luka continues playing inside the museum.
