# Save/load and persistence

Verified source contract, 2026-11-08. Normal play loads and writes **schema 21**, `CashSave`, using `src/persistence/cash-save.ts`. Lower version types remain active parser/transition sub-contracts; their comments are not the current top-level version.

## Storage and lifecycle

One JSON localStorage value is stored under `museum-for-luka-v2`. Development `?purchases=1` and `?helpers=1` use `:purchases-qa` and `:helpers-qa` suffixes and separate writer locks. `prototype.ts` supplies the adapter; lower writers always address `SAVE_KEY` through that adapter. Browser profile and exact origin determine the storage namespace. `Start Game.bat` uses `localhost:5180`; another host/port has different saved data.

`createSaveSession` requires a browser Web Lock for the selected slot. `createCommitter` serializes durable commands and publishes critical outcomes after successful writes. `createSaveWriter` serializes whole cloned snapshots, schedules incremental checkpoints at 1,000 ms, and supports flush/cancel/reset with generation guards. Blur, activity and page lifecycle handlers flush pending work. Failed writes retain their candidate and block new mutation until retry/reset. Invalid or unsupported saves are kept intact behind the recovery UI; no automatic discard is implemented.

There is no backup-slot system, downloadable export/import UI, V1 import, backend or cloud synchronization in the current application. Reset is explicit and confirmed, clears only the selected slot, and creates a new seed/save. It does not preserve currency as a reset reward.

## Illustrative current structure

This is a **shape illustration, not an importable fixture**: the soil manifest is omitted and populated values must satisfy the accounting/exposure validators.

```ts
{
  version: 21,
  activeSiteId: 'courtyard-dig',
  room: 'museum', // museum | outdoors | excavation
  dig: { /* cellId: normalized column progress 0..1 */ },
  cleaning: { /* discoveryId: unique cleaned indices 0..335 */ },
  collected: [/* discovery IDs */],
  closedSites: [/* site IDs */],
  placed: [/* part/group IDs */],
  economy: {
    version: 1, seed: 123, coins: 20,
    sites: {
      'courtyard-dig': {
        layout: 1, levels: 1,
        outcomes: { /* site/v1/cell/layer: 0 or 1 */ },
        excluded: [], claimed: []
      }
    }
  },
  museum: { version: 1, owned: [/* {id, source:'purchase'|'legacy', paid} */] },
  world: {
    version: 1,
    location: { kind: 'hub' }, // or {kind:'site-camp'|'site-pit', siteId}
    owned: [/* paid/legacy site receipts; first site is implicit */]
  },
  visitors: { version: 1, nextId: 1, sales: [0,0,0], visits: [/* {id,paid} */] },
  helpers: {
    version: 1, nextTask: 1,
    owned: [/* {id:'helper-1',paid:60,siteId:null,phase:'idle',task:null} */]
  },
  custody: { /* discoveryId: {siteId,location:'storage'}
              or {siteId,location:'delivery',helperId:'helper-1'} */ },
  upgrades: { version: 1, owned: [/* {id,paid}; helper-tools also helperId */] },
  payments: { version: 1, partial: { /* purchaseId: coins already contributed */ } },
  pendingTicketRevenue: 0
}
```

An active helper task stores `id, siteId, cellId, layer, start, work, required`. `start` is the starting normalized soil fraction; work/required use baseline units so an upgrade changes rate without resetting percentage. `Visit.paid` is zero when unpaid or the actual locked ticket charge when paid. `sales` records lifetime counts at prices 2, 3, 4, not current queue lengths.

## Persisted versus derived/runtime state

| Persisted | Derived or transient |
| --- | --- |
| Room category, active site, world destination | Exact player position, camera, meshes, modal and pointer state |
| Dig fractions, cleaning indices, collected/placed IDs, closed sites | Inventory, percentages, exposed finds, display completion, tutorial dismissal |
| Coin seed/manifests/claims/exclusions and coins | Reward animations, HUD gain timers |
| Stand/wing/site/helper/upgrade receipts and partial deposits | Eligibility, effective stats, actual stand geometry |
| Pending ticket revenue, visit IDs/payment flags and lifetime sales | Actor poses/routes, selected viewing positions/durations, service/arrival clocks |
| Helper assignment/task/work and find custody | Helper pose/path/shovel/pickup animation |

On load `loadCashSave()` retires paid visitors and settles in-flight finds into original-site storage. Unpaid visitors survive. Helper task metadata is validated and normalized to paused/idle; invalid assignment/task metadata can be retired without deleting valid paid ownership. Recoverable world location metadata falls back to the hub; a saved closed pit becomes its camp. Fundamental progress/economy inconsistencies reject the save instead of silently granting or deleting entitlements.

## Schema chain and validators

| Schema | Contract / parser |
| --- | --- |
| 1–5 | Early discovery, grid/shovel evolution, site closure and explicit collection/full-tray cleaning; `persistence/save.ts` legacy parsing |
| 6–7 | Placed groups, then six-part Dimetrodon conversion |
| 8–10 | Whole slab/separate site, shared first pit, then Eryops and second playable site |
| 11–12 | Multi-tile footprint conversion and reorientation; schema 12 remains the journey sub-contract |
| 13 | Economy/seed/finite manifests: `parseGameSave` |
| 14 | Stand/wing ownership: `parseMuseumSave` |
| 15 | Paid-site ownership and location: `parseTravelSave` |
| 16 | Visitor IDs, sales ledger and paid/unpaid visits: `parseTicketSave` |
| 17 | Helper ownership/assignment/tasks: `parseHelperSave` |
| 18 | Find custody/delivery/storage: `parseStorageSave` |
| 19 | Permanent paid upgrades: `parseUpgradeSave` |
| 20 | Partial stand/wing deposits: `parsePaymentSave` |
| 21 | Pending ticket cash: `parseCashSave` |

Each current wrapper validates its fields, adapts/refunds its accounting into the earlier parser, then restores the actual balance. These temporary refunds are validation arithmetic, not money granted to the player. Schema 21 validates spendable plus pending against the existing income ledger. Older ticket proceeds were already spendable; migration adds pending zero.

`parseSave()` checks known IDs, unique lists/masks, finite progress, exposure before cleaning/collection, collection before placement, prerequisite closure before site progress, and complete recovery/soil before closure. `parseGameSave()` validates exact deterministic outcomes, manifest layers/keys and claimed/excluded consistency. Higher parsers check safe integers, receipt amounts, ownership/progression consistency, visitor sequence/count accounting and custody exclusivity. Many structures enforce exact keys; others validate allowed keys and required values. This is not a cryptographic anti-cheat or immutable event log.

Historic migrations preserve older V2 entitlements through explicit conversions. In particular, pre-purchase museum saves gain the complete then-existing hall as legacy receipts; older earned second-site access can receive a legacy site receipt. This is unrelated to importing V1-game saves. Current/future unknown versions are rejected by older readers.

## Compatibility hazards for new content/rooms

1. **Live content in historical validators.** Schema 12/13 checks import current `SITES`/parts and deterministic coin rules. Changed cell identity, layers, find coverage or reward rates can invalidate old saves. Freeze/version layouts and validate old content before conversion.
2. **Legacy museum receipts.** `migrateMuseumSave()` grants `PURCHASES.map(...)`; `parseMuseumSave()` requires legacy ownership to match the entire current offer set. Expanding that array naively can both reject older legacy saves and grant unintended future rooms/stands. Freeze the legacy grant set.
3. **Hard-coded ownership gates.** `parseTravelSave()` permits at most one owned site and requires `eryops-dig`; museum validation requires Eryops/west-wing relationships and a non-Eryops display for paid wing ownership.
4. **Ticket representation.** Three counters and only 2/3/4 paid prices block a fourth completed display's payment. New content needs a ledger version/migration, not only a longer exhibit array.
5. **Closed sites.** Adding uncollected required discoveries to a closed site contradicts its stored closure; preserve history or explicitly reopen/extend via migration without granting collection or duplicating soil money.
6. **State reconstruction.** `economyOf`, `museumJourney`, `advanceMuseum`, loaders, travel and reset explicitly compose versions/fields. New room state must survive every path, including helper/storage/upgrade commands and pending critical retries.
7. **New spending.** Room and stand receipts/deposits must participate in the same lifetime accounting equation. Changing live prices without historical receipt handling can reject previously valid purchases.

Recommendation: introduce a deliberately versioned current content/room contract with stable IDs and a tested migration from real schema-21 cases. Retain the existing commit/session safety machinery. The product policy for mapping already-owned west-wing saves into the new rooms remains a decision; do not silently revoke or grant progress.
