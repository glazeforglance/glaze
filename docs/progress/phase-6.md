# Phase 6: a complete visual editor

Goal: a user never has to touch YAML. Every option Glance v0.8.7 knows can be set through the UI,
and everything the UI writes is valid for Glance. The YAML view stays as an escape hatch.

Work through the parts in order; tick items as they land and commit this file with each part.
A new session continues from the first unticked item.

After every part: `pnpm test`, `pnpm typecheck`, `pnpm --filter web lint`, `pnpm build`.

## 6a — Drag & drop flicker ✅

- [x] Verify the hypothesis (indicator in layout flow, re-measuring feedback loop, drop moment)
- [x] Indicator never changes layout (chosen approach documented)
- [x] Hysteresis around item midpoints
- [x] Drop lands exactly where the indicator was shown
- [x] Keyboard drag, announcements, head-widget rows, library drops, empty columns still work
- [x] Unit tests for `drop-target.ts` / `dnd-geometry.ts`, incl. "small moves don't toggle"

Findings: the in-flow `<DropIndicator>` pushed widgets down and `MeasuringStrategy.Always`
re-measured them, so the target moved with the layout. The worst loop was the 8 px gap between
widgets: only the list droppable covered it, which meant "end of list", so crossing a gap
sent the indicator to the bottom and back. The drop itself was one render (dnd-kit batches
`onDragEnd`), but the target was recomputed from dnd-kit's `over`, so a drop in a gap
landed at the end of the list instead of where the indicator was.

Fix: an absolutely positioned indicator drawn from measured rects (`dnd-geometry.ts`,
`dnd-measure.ts`), hysteresis on both the slot (±12 px around midpoints) and the list edge,
and the drop uses the shown target. Chosen over `@dnd-kit/sortable` because its
cross-container moves reshuffle state mid-drag (another flicker source) and 6c's
"beside" zones are simpler as lines. Browser check: 20 random fast drags gave 0 layout
changes and 0 flip-backs.

## 6b — Resizable side panels ✅

- [x] Generalised `SplitHandle` → `components/ui/ResizeHandle.tsx` (separator role, aria values, arrows ±16 px, Home/End); the code/preview split uses it too
- [x] Library 200–420 px, inspector 280–560 px, double-click resets
- [x] Widths remembered per viewer in `localStorage` (`glaze:panel:<id>`, try/catch, default without storage)
- [x] Collapse buttons for both panels (collapsed: a thin strip with an expand button)

## 6c — Widget width (`split-column`) ✅

- [x] Core: `wrapInSplitColumn` (also wraps a widget alone), `addToSplitColumn`, `unwrapSplitColumn`, `setSplitColumns` (+ round-trip tests: wrap → unwrap is byte for byte)
- [x] Layout validation covers the new rules: `nested-group` (Glance) and `split-in-head` (a Glaze editing rule, refused by every edit but not a publish error, because Glance accepts it)
- [x] Drop beside a widget (left/right zones) → new split-column / add to existing one
- [x] Resize handle on split-column children: ½ / ⅓ / ¼ with snap label and shared-width notice
- [x] Column edge drag toggles small ↔ full, with a reason when not allowed
- [x] Auto-unwrap a split-column left with one child, with an undoable notice (restores the document from just before)
- [x] Canvas: split-column children side by side (row by row, labelled approximate), groups as tabs
- [x] Rules: none inside a group, no resize in a group, head widgets can't split
- [x] Style tab: Full / ½ / ⅓ / ¼ buttons (for a split-column itself: its columns + "below each other again")

Notes: there is no general undo yet, so the auto-unwrap notice keeps the document from before the
unwrap. Keyboard drags stay in head widgets and columns; widths have keyboard controls in the
Style tab and on the resize handle (a slider).

## 6d — Generated widget schemas ✅

- [x] `scripts/generate-widget-schemas.ts` (`pnpm schemas`; downloads the tag's tarball, or `--source <checkout>`, default `v0.8.7`)
- [x] All 28 factory types incl. aliases (`stocks` → `markets`), `widgetBase`, `containerWidgetBase`, nested structs, slices, maps, plus `page` and `config`
- [x] Custom `UnmarshalYAML` types in an explicit table (an unknown one fails), `initialize()` defaults, enums (`!=` chains, `switch` on constants, map keys), required checks, `yaml:"-"`, unexported fields, `,inline` (also from `pkg/sysinfo`)
- [x] `packages/schemas` (`@glaze/schemas`) with `GENERATED_FROM = "v0.8.7"`
- [x] `overrides.ts` merged in; the generator fails on overrides for missing fields, on enums that drop values the code accepts, and on options the code compares with words that aren't classified
- [x] `--check` mode in CI (`pnpm schemas --check`)

Code over docs (help texts say so): dns-stats `service` is required in v0.8.7 (empty is an
error), and a missing iframe `height` gives 50 px.

## 6e — Forms for every widget

- [ ] Generic `SchemaForm` for every field kind
- [ ] All 27 widget types + `widgetBase`
- [ ] custom-api editor (request, subrequests, options, template editor + cheat-sheet, frameless)
- [ ] html / extension / iframe with the right warnings
- [ ] New widgets start valid; publish review blocks with friendly messages
- [ ] Unknown keys kept and listed under "Other options"
- [ ] `${ENV}` values shown as ENV chips, never resolved

## 6f — Page settings and head widgets

- [ ] Page settings in the inspector (name, slug with suggestion + uniqueness, width, nav width, toggles)
- [ ] Head widgets fully editable on the canvas

## 6g — Global Settings view

- [ ] Settings view next to Design / Code / Preview
- [ ] Server section with a warning when Glaze's access to Glance changes
- [ ] Auth: users, bcrypt password hashes, secret-key generator, warnings
- [ ] Document head editor with a script warning
- [ ] Branding
- [ ] Theme (basic) with HSL pickers and presets

## 6h — Verification

- [ ] Fixtures per widget type from Glance's docs (fake keys and domains)
- [ ] Round-trip test: form state → core edits → YAML, no unintended diff
- [ ] New-widget output passes validation
- [ ] CI integration test with the Glance v0.8.7 binary (`config:validate`)
- [ ] Coverage test: every generated field is reachable in a form
- [ ] Manual check list (below)

### Manual check list

- [ ] Drag 20 widgets around quickly: no flicker
- [ ] Build a split-column by dropping beside a widget
- [ ] Resize it to ⅓
- [ ] Resize both side panels
- [ ] Edit page settings and every Settings section
- [ ] Publish
- [ ] Glance renders it

## 6i — Docs

- [ ] DESIGN.md: roadmap, widget width out of Extras, `@glaze/schemas` + generator under §8, §12 answer
- [ ] README "Why Glaze?" and roadmap
- [ ] CHANGELOG `[Unreleased]`
- [ ] Screenshots re-taken and checked

## Notes for the next session

- Glance v0.8.7 source: clone `https://github.com/glanceapp/glance` at tag `v0.8.7`, or let
  `pnpm schemas` download it.
- Browser checks: run the API with a scratch config, not `.dev/` (e.g. a copy of
  `docs/screenshots/demo/glance.yml` and `GLAZE_AUTH=off` in an env file passed with `--env-file`).
