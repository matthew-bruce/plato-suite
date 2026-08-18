// Standalone HTML export for the Resource Timeline.
//
// Produces a single self-contained file: no Plato login, no database, no
// framework runtime, no external requests. Matt emails it to people who do not
// have Plato accounts and it works when they open it.
//
// What gets serialised is the DERIVED dataset — the same post-computation
// segments the live page renders, not raw DB rows. The export therefore cannot
// disagree with the screen it was taken from, and none of the derivation logic
// has to be reimplemented in the exported file.
//
// Grouping, filtering and collapse/expand all still work in the export because
// none of them need a live connection — only the already-fetched data. The
// tables that drive them (category order, role ranking, status labels) are
// injected from the shared presentation module rather than retyped, so there is
// one source of truth for the rules and only the DOM-building differs.

import { CATEGORY_ORDER, type ResourceTimelineData } from '@plato/schema'
import {
  STATUS_LABELS,
  buildQuarterSpans,
  disciplineRank,
  formatMonthLabel,
  supplierStripe,
  supplierTint,
} from './presentation'

export interface ExportOptions {
  groupBy: string
  activeSuppliers: string[]
  transitionOnly: boolean
  generatedAt: Date
}

/**
 * Escape a string for interpolation into HTML text or an attribute value.
 * Resource names, team names and free-text notes all come from the database
 * and are not trusted to be markup-safe.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Serialise data for embedding inside a <script> block. Escaping '<' covers
 * the two ways a string value could otherwise terminate the script element
 * early — a literal '</script>' and an '<!--' comment opener.
 */
function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

/** Ranking table, materialised for the disciplines actually present. */
function buildRankTable(data: ResourceTimelineData): Record<string, number> {
  const table: Record<string, number> = {}
  for (const discipline of data.disciplines) {
    table[discipline] = disciplineRank(discipline === 'Unassigned discipline' ? null : discipline)
  }
  return table
}

/** Per-supplier colour triple, precomputed so the file needs no colour maths. */
function buildSupplierPalette(
  data: ResourceTimelineData,
): Record<string, { name: string; colour: string; tint: string; stripe: string }> {
  const palette: Record<string, { name: string; colour: string; tint: string; stripe: string }> = {}
  for (const supplier of data.suppliers) {
    palette[supplier.abbreviation] = {
      name: supplier.name,
      colour: supplier.colour,
      tint: supplierTint(supplier.colour),
      stripe: supplierStripe(supplier.colour),
    }
  }
  return palette
}

export function buildStandaloneHtml(
  data: ResourceTimelineData,
  options: ExportOptions,
): string {
  const payload = {
    windowStart: data.windowStart,
    windowEnd: data.windowEnd,
    months: data.months.map((m) => ({ key: m, label: formatMonthLabel(m) })),
    // Precomputed here (not re-derived in the vanilla-JS runtime below) so
    // the export's quarter row can never disagree with the live page's —
    // one source of truth for the split, reused rather than duplicated.
    quarters: buildQuarterSpans(
      data.months,
      data.granularWindowStart,
      data.coarsePeriodName,
      data.granularPeriodName,
    ).map((span) => ({ label: span.label, monthCount: span.months.length })),
    resources: data.resources,
    suppliers: data.suppliers,
    teams: data.teams,
    disciplines: data.disciplines,
    categoryOrder: CATEGORY_ORDER,
    statusLabels: STATUS_LABELS,
    rankTable: buildRankTable(data),
    palette: buildSupplierPalette(data),
    initial: {
      groupBy: options.groupBy,
      activeSuppliers: options.activeSuppliers,
      transitionOnly: options.transitionOnly,
    },
    meta: {
      coarsePeriodName: data.coarsePeriodName,
      granularPeriodName: data.granularPeriodName,
      generatedAt: options.generatedAt.toISOString(),
      generatedLabel: options.generatedAt.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    },
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Resource Timeline — ${escapeHtml(data.coarsePeriodName)} to ${escapeHtml(data.granularPeriodName)}</title>
<style>
${EXPORT_CSS}
</style>
</head>
<body>
<div class="page-header">
  <div class="brand"><div class="mark">P</div><div class="word">Plato <span>Suite</span></div></div>
  <span class="snapshot-badge">Snapshot · ${escapeHtml(payload.meta.generatedLabel)}</span>
</div>

<div class="title-row">
  <h1>Resource Timeline</h1>
  <div class="sub" id="subtitle"></div>
</div>

<div class="controls">
  <div class="toolbar">
    <div class="toolbar-primary">
      <div class="mode-pill">
        <span class="mode-pill-label">Group by</span>
        <div class="mode-buttons" id="groupToggle">
          <button data-group="team">Team</button>
          <button data-group="discipline">Skillset</button>
          <button data-group="category">Transition category</button>
        </div>
      </div>
      <div class="toolbar-divider"></div>
      <span class="select-wrap" id="secLabelWrap">
        <span id="secLabel">Skillset</span>
        <select id="secondaryFilter"></select>
      </span>
      <div class="mode-pill" id="showPill">
        <span class="mode-pill-label" id="showLabel">Show</span>
        <div class="mode-buttons" id="transitionToggle">
          <button data-mode="all">Everyone</button>
          <button data-mode="transition">Transitioning only</button>
        </div>
      </div>
      <div class="primary-actions">
        <span class="resource-count" id="resourceCount"></span>
        <button type="button" class="expand-all-btn" id="expandAllBtn"></button>
      </div>
    </div>
    <div class="toolbar-filter">
      <button class="preset-btn" id="allSuppliersBtn">All suppliers</button>
      <div class="chip-filter" id="supplierChips"></div>
      <button class="preset-btn" id="presetBtn">Focus: CG + TCS</button>
    </div>
  </div>
</div>

<div class="timeline-header-wrap">
  <div class="thl-spacer"><span id="spacerLabel">Team / Resource</span></div>
  <div class="thl-timeline">
    <div class="today-tag-row" id="todayTagHost"></div>
    <div class="quarter-row" id="quarterRow"></div>
    <div class="month-row" id="monthRow"></div>
  </div>
</div>

<div class="gantt-wrap" id="ganttWrap">
  <div id="left-col"></div>
  <div id="right-col"></div>
</div>

<div class="tooltip" id="tt" hidden>
  <div class="tt-name" id="tt-name"></div>
  <div class="tt-sub" id="tt-sub"></div>
  <div id="tt-rows"></div>
  <div class="tt-flag" id="tt-flag" hidden></div>
</div>

<script>
const DATA = ${embedJson(payload)};
${EXPORT_SCRIPT}
</script>
</body>
</html>`
}

/* ── Inlined stylesheet ────────────────────────────────────────────── */
// Mirrors resourceTimeline.module.css with the --rmg-* tokens resolved to
// their literal values, since the export cannot import the design system.

const EXPORT_CSS = `
:root{
  --rmg-color-red:#DA202A; --rmg-color-black:#2A2A2D; --rmg-color-brand-black:#2A2A2A;
  --rmg-color-grey-1:#8F9495; --rmg-color-grey-2:#D5D5D5; --rmg-color-grey-3:#EEEEEE;
  --rmg-color-grey-4:#F5F5F5; --rmg-color-white:#FFFFFF;
  --rmg-color-surface-white:#FFFFFF; --rmg-color-surface-light:#F1F2F5;
  --rmg-color-text-heading:#2A2A2D; --rmg-color-text-body:#333333; --rmg-color-text-light:#666666;
  --rmg-color-green-contrast:#008A00;
  --rmg-font-body:"PF DINText Std","Helvetica Neue",Arial,sans-serif;
  --rmg-font-display:"RM First Class",Georgia,serif;
  --rmg-radius-xs:4px; --rmg-radius-s:8px; --rmg-radius-m:12px; --rmg-radius-xl:100px;
  --left-col:300px; --row-h:48px; --page-header-h:40px;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--rmg-color-surface-light);color:var(--rmg-color-text-body);font-family:var(--rmg-font-body);font-size:13px;line-height:1.4;-webkit-font-smoothing:antialiased}
.page-header{background:var(--rmg-color-black);height:var(--page-header-h);display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:400}
.brand{display:flex;align-items:center;gap:8px}
.brand .mark{width:22px;height:22px;background:var(--rmg-color-red);border-radius:4px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:12px}
.brand .word{font-size:13px;font-weight:700;color:#fff}
.brand .word span{color:var(--rmg-color-red)}
.snapshot-badge{font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:2px 8px;border-radius:var(--rmg-radius-xs);background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2)}
.title-row{padding:16px 24px 0}
/* Sans-serif here, not the site-wide display font — a document meant to be
   shared outside Plato (no login, emailed around) reads better in the plain
   body face than in the serif display font the in-app page heading uses.
   Scoped to this export template only; the in-app heading is unchanged. */
.title-row h1{font-family:var(--rmg-font-body);font-size:19px;font-weight:700;color:var(--rmg-color-text-heading)}
.title-row .sub{font-size:11.5px;color:var(--rmg-color-text-light);margin-top:2px}
.controls{padding:12px 24px 4px}
/* Two-band toolbar — red primary row, grey-4 filter row — mirroring
   @plato/ui's shared PageToolbar component exactly (the same one Schedule
   and People build their toolbars from), not a one-off invented for export. */
.toolbar{border-radius:var(--rmg-radius-m);overflow:hidden;border:1px solid rgba(0,0,0,.10);box-shadow:0 2px 12px rgba(0,0,0,.08)}
.toolbar-primary{background:var(--rmg-color-red);display:flex;align-items:center;gap:10px;padding:10px 14px;flex-wrap:wrap}
.toolbar-filter{background:var(--rmg-color-grey-4);border-top:1px solid var(--rmg-color-grey-3);display:flex;align-items:center;gap:8px;padding:10px 20px;flex-wrap:wrap}
/* Rebuilt against Schedule's actual CustomSelect box model (1px solid
   grey-2 border, --rmg-radius-s corners, 5px 10px padding) so Group-by and
   Show sit at identical height/weight to the Skillset filter beside them —
   no double layer of padding, which is what previously made this control
   read taller than its neighbour. */
.mode-pill{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--rmg-color-grey-2);border-radius:var(--rmg-radius-s);padding:5px 10px;box-sizing:border-box}
.mode-pill-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--rmg-color-grey-1);white-space:nowrap;flex-shrink:0}
.mode-buttons{display:flex;align-items:center;gap:2px}
.mode-buttons button{border:none;background:transparent;padding:0 8px;border-radius:5px;font-size:12px;font-weight:400;color:var(--rmg-color-text-body);cursor:pointer;font-family:inherit;white-space:nowrap;transition:background-color .12s,color .12s}
.mode-buttons button:hover:not(.active){color:var(--rmg-color-text-heading)}
.mode-buttons button.active{background:#FFF5F5;color:var(--rmg-color-red);font-weight:600}
/* Schedule's one divider, after its search box. */
.toolbar-divider{width:1px;height:18px;background:var(--rmg-color-grey-2);flex-shrink:0;margin:0 4px}
.primary-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;row-gap:6px;margin-left:auto;min-width:0}
.resource-count{font-size:11px;font-weight:600;color:rgba(255,255,255,.7);white-space:nowrap}
.expand-all-btn{display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.35);border-radius:var(--rmg-radius-s);padding:7px 12px;font-size:11px;font-weight:700;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap}
.expand-all-btn:hover{background:rgba(255,255,255,.22)}
.expand-all-btn svg{transition:transform .12s}
.expand-all-btn.expanded svg{transform:rotate(180deg)}
/* Supplier filter pill — mirrors PageToolbarFilterPill's getFilterPillStyle
   exactly (border-radius xl, tinted+bordered when inactive, solid fill when
   active), computed per-chip in JS since each supplier's colour differs. */
.chip{border-radius:var(--rmg-radius-xl);padding:4px 12px;font-size:11px;font-weight:600;border:1.5px solid;cursor:pointer;font-family:inherit;white-space:nowrap;line-height:1.4}
.preset-btn{display:inline-flex;align-items:center;padding:4px 12px;border-radius:var(--rmg-radius-xl);font-size:11px;font-weight:600;border:1.5px solid var(--rmg-color-black);background:var(--rmg-color-black);color:#fff;font-family:inherit;cursor:pointer;white-space:nowrap}
.preset-btn.inactive{background:transparent;color:var(--rmg-color-dark-grey);border-color:var(--rmg-color-grey-2)}
/* Secondary filter — a plain native <select> (no floating-panel JS needed in
   a file that has to just work when double-clicked from an email), styled to
   the same white-pill / red-when-active language as CustomSelect on Schedule. */
.select-wrap{display:inline-flex;align-items:center;gap:5px;background:#fff;border:1px solid var(--rmg-color-grey-2);border-radius:var(--rmg-radius-s);padding:5px 10px}
.select-wrap.active{border-color:var(--rmg-color-red);background:#FFF5F5}
.select-wrap span{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--rmg-color-grey-1)}
.select-wrap select{font-size:12px;font-family:inherit;font-weight:400;color:var(--rmg-color-text-body);border:none;background:transparent;cursor:pointer}
.select-wrap.active select{color:var(--rmg-color-red);font-weight:600}
/* Sticky: pinned just below the page-header brand bar (--page-header-h),
   same offset convention the live app uses below PlatoShell's global header.
   z-index promotes it above .gantt-wrap, a later, non-positioned sibling
   that would otherwise paint over it as its rows scroll past; the opaque
   background is what makes scrolled-under rows disappear behind it rather
   than showing through. */
.timeline-header-wrap{display:flex;padding:6px 24px 0;position:sticky;top:var(--page-header-h);z-index:20;background:var(--rmg-color-surface-light)}
.thl-spacer{width:var(--left-col);flex-shrink:0;padding:0 12px 6px 4px;display:flex;align-items:flex-end}
.thl-spacer span{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--rmg-color-grey-1)}
.thl-timeline{flex:1;min-width:0;display:flex;flex-direction:column}
.today-tag-row{height:15px;position:relative}
.today-tag{position:absolute;bottom:0;transform:translateX(-50%);font-size:9px;font-weight:700;color:var(--rmg-color-red);text-transform:uppercase;letter-spacing:.05em;white-space:nowrap}
/* Structural label row — same quiet weight as the "Team / Resource" spacer
   label, just dark rather than muted grey-1. Owns the header box's rounded
   top corners, since it's now the topmost row. */
.quarter-row{display:flex;height:20px;background:var(--rmg-color-grey-4);border:1px solid var(--rmg-color-grey-3);border-radius:var(--rmg-radius-s) var(--rmg-radius-s) 0 0}
.quarter-cell{display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--rmg-color-text-heading);border-right:1px solid var(--rmg-color-grey-3)}
.quarter-cell:last-child{border-right:none}
/* Pastel tint, not plain white — the detailed axis, distinct from the
   quarter row above it. Yellow: unused elsewhere (supplier identity uses
   blue/purple/orange/navy; tint-red is reserved for the today line/label). */
.month-row{display:flex;height:26px;background:var(--rmg-color-tint-yellow);border-left:1px solid var(--rmg-color-grey-3);border-right:1px solid var(--rmg-color-grey-3)}
.month-cell{flex:1;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--rmg-color-text-heading);border-right:1px solid var(--rmg-color-grey-3)}
.month-cell:last-child{border-right:none}
.gantt-wrap{display:flex;margin:0 24px 40px;background:#fff;border-radius:0 0 var(--rmg-radius-m) var(--rmg-radius-m);box-shadow:0 4px 56px rgba(0,0,0,.08);border:1px solid var(--rmg-color-grey-3);position:relative}
#left-col{width:var(--left-col);flex-shrink:0;border-right:1px solid var(--rmg-color-grey-3)}
#right-col{flex:1;min-width:0;position:relative}
.today-line{position:absolute;top:0;bottom:0;width:1px;background:var(--rmg-color-red);z-index:15;pointer-events:none}
.group-block{border-bottom:1px solid var(--rmg-color-grey-3)}
.group-block:last-child{border-bottom:none}
.group-left-header{height:36px;display:flex;align-items:center;padding:0 10px 0 8px;gap:8px;background:var(--rmg-color-grey-4);cursor:pointer;user-select:none;border-bottom:1px solid var(--rmg-color-grey-2)}
.group-left-header:hover{background:#ECECEC}
.chevron{flex-shrink:0;width:12px;height:12px;display:flex;align-items:center;justify-content:center;color:var(--rmg-color-grey-1);transition:transform .18s ease}
.group-block.collapsed .chevron{transform:rotate(-90deg)}
.group-header-text{display:block;line-height:1.3;font-size:14.5px;font-weight:700;color:var(--rmg-color-red);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex-shrink:1}
.group-count{font-size:11px;font-weight:600;color:var(--rmg-color-grey-1);flex-shrink:0;margin-left:auto;padding-left:8px}
.group-right-header{height:36px;background:var(--rmg-color-grey-4);border-bottom:1px solid var(--rmg-color-grey-2);cursor:pointer;position:relative}
.res-left-row{height:var(--row-h);display:flex;align-items:center;padding:0 10px 0 4px;gap:8px;border-bottom:1px solid var(--rmg-color-grey-4);background:#fff;overflow:hidden;transition:height .15s ease,opacity .13s ease}
.res-left-row:last-child,.res-right-row:last-child{border-bottom:none}
.group-block.collapsed .res-left-row,.group-block.collapsed .res-right-row{height:0;opacity:0;pointer-events:none;border-bottom:none;overflow:hidden}
.avatar{width:32px;height:32px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--avatar-colour,var(--rmg-color-brand-black));color:#fff;font-size:12px;font-weight:700;text-shadow:0 1px 1.5px rgba(0,0,0,.45)}
.avatar-split{background:conic-gradient(from 180deg,var(--avatar-from) 0deg 180deg,var(--avatar-to) 180deg 360deg)}
.res-text{min-width:0;flex:1}
.res-name{font-size:14px;color:var(--rmg-color-text-heading);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
.res-sub{font-size:11px;color:var(--rmg-color-grey-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase;letter-spacing:.04em;margin-top:2px}
.res-pills{display:flex;gap:4px;flex-wrap:nowrap;overflow:hidden;margin-top:2px}
.team-pill{display:inline-flex;align-items:center;border-radius:var(--rmg-radius-xl);padding:2px 8px;background:#E4EDFA;color:#2A3B66;font-size:9px;font-weight:600;white-space:nowrap;flex-shrink:0}
.status-tag{font-size:9px;font-weight:700;flex-shrink:0;white-space:nowrap}
.res-right-row{height:var(--row-h);position:relative;border-bottom:1px solid var(--rmg-color-grey-4);transition:height .15s ease,opacity .13s ease}
.col-lines{position:absolute;inset:0;display:flex;pointer-events:none}
.col-line{flex:1;border-right:1px solid var(--rmg-color-grey-4)}
.col-line:last-child{border-right:none}
.track{position:absolute;left:0;right:0;top:50%;height:1px;background:var(--rmg-color-grey-3)}
.seg{position:absolute;top:6px;bottom:6px;border-radius:6px;border-left:4px solid var(--sc);background:var(--sct);display:flex;align-items:center;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(0,0,0,.04)}
.seg.hyper{background-image:repeating-linear-gradient(45deg,var(--sc2) 0 5px,var(--sct) 5px 10px)}
.seg.tentative{border-left-style:dashed;background-image:repeating-linear-gradient(135deg,var(--sct) 0 6px,#fff 6px 12px)}
.seg:hover{filter:brightness(.96);z-index:20;box-shadow:0 0 0 1.5px var(--sc)}
.seg-label{font-size:9.5px;font-weight:700;color:var(--sc);white-space:nowrap;padding:0 7px;letter-spacing:.01em;overflow:hidden;text-overflow:ellipsis}
.seg-label .dates{font-weight:500;opacity:.75;margin-left:5px}
.gap-marker{position:absolute;top:50%;height:2px;transform:translateY(-1px);background:repeating-linear-gradient(90deg,var(--rmg-color-red) 0,var(--rmg-color-red) 3px,transparent 3px,transparent 6px);z-index:5}
.flag-dot{position:absolute;top:2px;width:6px;height:6px;border-radius:50%;background:var(--rmg-color-red);border:1.5px solid #fff;z-index:21}
.tooltip{position:fixed;z-index:9999;background:#fff;border:1px solid var(--rmg-color-grey-2);border-radius:var(--rmg-radius-s);padding:10px 13px;pointer-events:none;max-width:270px;box-shadow:0 4px 56px rgba(0,0,0,.08)}
.tt-name{font-size:12px;font-weight:700;color:var(--rmg-color-text-heading)}
.tt-sub{font-size:10.5px;color:var(--rmg-color-text-light);margin-top:1px;margin-bottom:6px}
.tt-row{font-size:10.5px;color:var(--rmg-color-text-body);display:flex;justify-content:space-between;gap:14px;padding:2px 0}
.tt-row b{color:var(--rmg-color-text-heading)}
.tt-flag{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;margin-top:6px;padding-top:6px;border-top:1px solid var(--rmg-color-grey-4);color:var(--rmg-color-red)}
.empty{margin:0 24px;padding:32px;background:#fff;border:1px solid var(--rmg-color-grey-3);border-radius:var(--rmg-radius-m);text-align:center;color:var(--rmg-color-text-light)}
@media (max-width:768px){
  body{overflow-x:auto}
  .gantt-wrap,.timeline-header-wrap,.controls,.title-row{min-width:900px}
}
`

/* ── Inlined runtime ───────────────────────────────────────────────── */
// Plain DOM, no framework. Mirrors the grouping/filter/collapse rules in
// presentation.ts; the rule TABLES arrive in DATA so only the rendering is
// duplicated, never the policy.

const EXPORT_SCRIPT = String.raw`
var WIN_START = Date.parse(DATA.windowStart + 'T00:00:00Z');
var WIN_END = Date.parse(DATA.windowEnd + 'T00:00:00Z');
var DAY = 86400000;
var SPAN = (WIN_END - WIN_START) / DAY;

var TRANSITION_STATUSES = ['mover','mover_doj_tbc','joiner','rolledoff','rolledoff_hypercare','overlap_risk'];
var UNASSIGNED_DISCIPLINE = 'Unassigned discipline';

var state = {
  groupBy: DATA.initial.groupBy,
  activeSuppliers: new Set(DATA.initial.activeSuppliers),
  secondaryFilter: '',
  transitionOnly: DATA.initial.transitionOnly,
  collapsed: new Set()
};
// Names of the groups actually rendered on the last pass — used by the
// expand/collapse-all control, which (mirroring Schedule's own toggleAll)
// only ever reasons about what's currently visible, not every group that
// could theoretically exist under the active filters.
var lastRenderedGroupNames = [];

function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
}); }
function pct(iso){
  var v = Date.parse(iso.slice(0,10) + 'T00:00:00Z');
  var c = Math.max(WIN_START, Math.min(WIN_END, v));
  return (c - WIN_START) / DAY / SPAN * 100;
}
function fmtShort(iso){
  return new Date(iso.slice(0,10) + 'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
}
function fmtLong(iso){
  return new Date(iso.slice(0,10) + 'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'2-digit',timeZone:'UTC'});
}
function disciplineOf(r){ return r.discipline || UNASSIGNED_DISCIPLINE; }
function rankOf(r){ var d = disciplineOf(r); return d in DATA.rankTable ? DATA.rankTable[d] : 5; }
function palette(sup){ return DATA.palette[sup] || {name:sup,colour:'#8F9495',tint:'#8F949533',stripe:'#8F94954d'}; }

// Mirrors resolveAvatarColours() in lib/resource-timeline/presentation.ts —
// solid for a resource whose segments touch one supplier, split (from the
// chronologically first segment's supplier to the last's) for two or more.
// Segments arrive pre-sorted by deriveSegments, so first/last here is
// genuinely chronological, the same guarantee the React version relies on.
function avatarColour(r){
  var segs = r.segments;
  if (!segs.length) return {mode:'solid', colour:'#8F9495'};
  var from = segs[0].supplier, to = segs[segs.length-1].supplier;
  if (from === to) return {mode:'solid', colour:palette(from).colour};
  return {mode:'split', fromColour:palette(from).colour, toColour:palette(to).colour};
}

// Mirrors PageToolbarFilterPill's getFilterPillStyle — tinted+bordered when
// inactive, solid fill + white text when active, with the same "--all"
// sentinel treatment (solid black / transparent+grey) for the all-suppliers
// and preset buttons.
function filterPillStyle(colour, active){
  if (colour === '--all') {
    return active
      ? 'background:var(--rmg-color-black);color:#fff;border-color:var(--rmg-color-black)'
      : 'background:transparent;color:var(--rmg-color-dark-grey);border-color:var(--rmg-color-grey-2)';
  }
  var safe = /^#[0-9a-fA-F]{3,8}$/.test(colour) ? colour : '#8F9495';
  return active
    ? 'background:' + safe + ';color:#fff;border-color:' + safe
    : 'background:' + safe + '12;color:' + safe + ';border-color:' + safe + '38';
}

function groupNames(){
  if (state.groupBy === 'team') return DATA.teams;
  if (state.groupBy === 'discipline') return DATA.disciplines;
  return DATA.categoryOrder;
}
function inGroup(r, name){
  if (state.groupBy === 'team') return r.teams.some(function(t){ return t.teamName === name; });
  if (state.groupBy === 'discipline') return disciplineOf(r) === name;
  return r.categoryLabel === name;
}
function filtered(){
  return DATA.resources.filter(function(r){
    if (!r.segments.some(function(s){ return state.activeSuppliers.has(s.supplier); })) return false;
    if (state.groupBy === 'team' && state.secondaryFilter && disciplineOf(r) !== state.secondaryFilter) return false;
    if (state.groupBy === 'discipline' && state.secondaryFilter &&
        !r.teams.some(function(t){ return t.teamName === state.secondaryFilter; })) return false;
    if (state.transitionOnly && TRANSITION_STATUSES.indexOf(r.status) === -1) return false;
    return true;
  });
}

var CHEVRON = '<svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// Same double-chevron used by PageToolbarExpandButton on Schedule.
var EXPAND_ICON = '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" style="margin-right:5px;vertical-align:-1px"><path d="M2 4 L6 7 L10 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M2 7 L6 10 L10 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
function colLines(){
  var out = '';
  for (var i = 0; i < DATA.months.length; i++) out += '<div class="col-line"></div>';
  return '<div class="col-lines">' + out + '</div>';
}

function segLabel(s){
  var text = s.code === 'NPC' ? s.supplier + ' Hypercare' : s.supplier;
  var dates = '';
  if (s.realStart && s.realEnd) dates = fmtShort(s.start) + '–' + fmtShort(s.end);
  else if (s.realStart) dates = 'from ' + fmtShort(s.start);
  else if (s.realEnd) dates = 'to ' + fmtShort(s.end);
  return { text: text, dates: dates };
}

function render(){
  var left = document.getElementById('left-col');
  var right = document.getElementById('right-col');
  var wrap = document.getElementById('ganttWrap');
  left.innerHTML = ''; right.innerHTML = '';

  var list = filtered();
  document.getElementById('subtitle').textContent =
    list.length + ' of ' + DATA.resources.length + ' resources · ' +
    DATA.meta.coarsePeriodName + ' – ' + DATA.meta.granularPeriodName +
    ' · snapshot ' + DATA.meta.generatedLabel;
  document.getElementById('resourceCount').textContent = list.length + ' resources';

  var any = false;
  var renderedNames = [];
  groupNames().forEach(function(name){
    var members = list.filter(function(r){ return inGroup(r, name); });
    if (!members.length) return;
    any = true;
    renderedNames.push(name);
    if (state.groupBy === 'team') {
      members = members.slice().sort(function(a,b){
        var d = rankOf(a) - rankOf(b);
        return d !== 0 ? d : a.name.localeCompare(b.name);
      });
    }
    var collapsed = state.collapsed.has(name);
    var display = name === 'Unassigned' ? 'Unassigned — F_Gov / Overheads' : name;

    var lh = '<div class="group-left-header" data-g="' + esc(name) + '">' +
      '<span class="chevron">' + CHEVRON + '</span>' +
      '<span class="group-header-text" title="' + esc(display) + '">' + esc(display) + '</span>' +
      '<span class="group-count">' + members.length + ' resource' + (members.length === 1 ? '' : 's') + '</span></div>';

    members.forEach(function(r){
      var st = DATA.statusLabels[r.status] || {text:'',colour:''};
      var sub;
      if (state.groupBy === 'team') {
        sub = '<div class="res-sub">' + esc(disciplineOf(r)) + '</div>';
      } else {
        sub = '<div class="res-pills">' + r.teams.map(function(t){
          return '<span class="team-pill">' + esc(t.teamName) +
            (r.teams.length > 1 ? ' · ' + Math.round(t.capacitySplit * 100) + '%' : '') + '</span>';
        }).join('') + '</div>';
      }
      var av = avatarColour(r);
      var avStyle = av.mode === 'split'
        ? '--avatar-from:' + av.fromColour + ';--avatar-to:' + av.toColour
        : '--avatar-colour:' + av.colour;
      var avClass = 'avatar' + (av.mode === 'split' ? ' avatar-split' : '');
      lh += '<div class="res-left-row"><div class="' + avClass + '" style="' + avStyle + '">' + esc(r.initials) + '</div>' +
        '<div class="res-text"><div class="res-name">' + esc(r.name) + '</div>' + sub + '</div>' +
        (st.text ? '<span class="status-tag" style="color:' + esc(st.colour) + '">' + esc(st.text) + '</span>' : '') +
        '</div>';
    });

    var lb = document.createElement('div');
    lb.className = 'group-block' + (collapsed ? ' collapsed' : '');
    lb.innerHTML = lh;
    left.appendChild(lb);

    var rh = '<div class="group-right-header" data-g="' + esc(name) + '">' + colLines() + '</div>';
    members.forEach(function(r){
      var segs = r.segments.filter(function(s){ return state.activeSuppliers.has(s.supplier); });
      var bars = colLines() + '<div class="track"></div>';

      (r.gaps || []).forEach(function(g){
        var a = pct(g.start), b = pct(g.end);
        bars += '<div class="gap-marker" style="left:' + a + '%;width:' + (b - a) + '%"' +
          ' data-tip-name="' + esc(r.name) + '" data-tip-gap="' + esc(fmtLong(g.start) + ' → ' + fmtLong(g.end)) + '"></div>';
      });

      segs.forEach(function(s){
        var p = palette(s.supplier);
        var a = pct(s.start), w = Math.max(pct(s.end) - a, 0.6);
        var lab = segLabel(s);
        var cls = 'seg' + (s.code === 'NPC' ? ' hyper' : '') + (s.tentative ? ' tentative' : '');
        var flag = s.flag || (s.commercialStartMismatch ? 'Recorded commercial start differs from booked days'
                  : (s.tentative ? 'Tentative — subject to confirmation' : ''));
        bars += '<div class="' + cls + '" style="left:' + a + '%;width:' + w + '%;--sc:' + p.colour +
          ';--sct:' + p.tint + ';--sc2:' + p.stripe + '"' +
          ' data-tip-name="' + esc(r.name) + '"' +
          ' data-tip-sub="' + esc(p.name + (s.code === 'NPC' ? ' · Hypercare' : '')) + '"' +
          ' data-tip-from="' + (s.realStart ? esc(fmtLong(s.start)) : '') + '"' +
          ' data-tip-to="' + (s.realEnd ? esc(fmtLong(s.end)) : '') + '"' +
          ' data-tip-flag="' + esc(flag) + '">' +
          '<span class="seg-label">' + esc(lab.text) +
          (lab.dates ? '<span class="dates">' + esc(lab.dates) + '</span>' : '') + '</span></div>';
        if (flag) bars += '<div class="flag-dot" style="left:calc(' + a + '% + 4px)"></div>';
      });

      rh += '<div class="res-right-row">' + bars + '</div>';
    });

    var rb = document.createElement('div');
    rb.className = 'group-block' + (collapsed ? ' collapsed' : '');
    rb.innerHTML = rh;
    right.appendChild(rb);
  });

  wrap.style.display = any ? '' : 'none';
  var existingEmpty = document.getElementById('emptyState');
  if (existingEmpty) existingEmpty.remove();
  if (!any) {
    var e = document.createElement('div');
    e.id = 'emptyState'; e.className = 'empty';
    e.textContent = 'No resources match these filters.';
    wrap.parentNode.insertBefore(e, wrap);
  }

  lastRenderedGroupNames = renderedNames;
  syncExpandAllButton();
  attachGroupToggles();
  attachTooltips();
  positionToday();
  fitLabels();
}

// Mirrors Schedule's allExpanded/toggleAll: "expanded" means every currently
// rendered group is expanded, so a mixed manual state (some open, some
// closed) reads as not-fully-expanded and the button offers "Expand all"
// rather than lying about the current state.
function allGroupsExpanded(){
  return lastRenderedGroupNames.length > 0 &&
    lastRenderedGroupNames.every(function(name){ return !state.collapsed.has(name); });
}
function syncExpandAllButton(){
  var btn = document.getElementById('expandAllBtn');
  var expanded = allGroupsExpanded();
  btn.classList.toggle('expanded', expanded);
  btn.innerHTML = EXPAND_ICON + (expanded ? 'Collapse all' : 'Expand all');
}
function toggleAllGroups(){
  var expanded = allGroupsExpanded();
  state.collapsed = expanded ? new Set(lastRenderedGroupNames) : new Set();
  render();
}

function attachGroupToggles(){
  var headers = document.querySelectorAll('.group-left-header,.group-right-header');
  Array.prototype.forEach.call(headers, function(h){
    h.addEventListener('click', function(){
      var g = h.getAttribute('data-g');
      if (state.collapsed.has(g)) state.collapsed.delete(g); else state.collapsed.add(g);
      render();
    });
  });
}

function fitLabels(){
  var segs = document.querySelectorAll('.seg');
  Array.prototype.forEach.call(segs, function(seg){
    var label = seg.querySelector('.seg-label');
    if (!label) return;
    var dates = label.querySelector('.dates');
    label.style.display = ''; if (dates) dates.style.display = '';
    var w = seg.clientWidth;
    if (w < 34) { label.style.display = 'none'; return; }
    if (dates && label.scrollWidth > w - 10) dates.style.display = 'none';
    if (label.scrollWidth > w - 10) label.style.display = 'none';
  });
}

function positionToday(){
  var host = document.getElementById('todayTagHost');
  host.innerHTML = '';
  var old = document.querySelector('.today-line');
  if (old) old.remove();

  var now = new Date();
  var iso = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
  if (iso < DATA.windowStart || iso > DATA.windowEnd) return;

  var p = pct(iso);
  var tag = document.createElement('div');
  tag.className = 'today-tag';
  tag.style.left = p + '%';
  tag.textContent = 'Today · ' + now.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  host.appendChild(tag);

  var line = document.createElement('div');
  line.className = 'today-line';
  line.style.left = p + '%';
  document.getElementById('right-col').appendChild(line);
}

/* ── Tooltip ─────────────────────────────────────────────────────── */
var tt = document.getElementById('tt');
function place(e){
  var l = e.clientX + 14, t = e.clientY + 14;
  if (l + 280 > window.innerWidth) l = e.clientX - 280;
  if (t + 150 > window.innerHeight) t = e.clientY - 150;
  tt.style.left = l + 'px'; tt.style.top = t + 'px';
}
function attachTooltips(){
  var targets = document.querySelectorAll('[data-tip-name]');
  Array.prototype.forEach.call(targets, function(el){
    el.addEventListener('mouseenter', function(e){
      document.getElementById('tt-name').textContent = el.getAttribute('data-tip-name');
      var sub = el.getAttribute('data-tip-sub') || '';
      var subEl = document.getElementById('tt-sub');
      subEl.textContent = sub; subEl.hidden = !sub;

      var rows = '';
      var gap = el.getAttribute('data-tip-gap');
      if (gap) {
        rows = '<div class="tt-row"><span>Coverage gap</span><b>' + esc(gap) + '</b></div>';
      } else {
        var from = el.getAttribute('data-tip-from'), to = el.getAttribute('data-tip-to');
        if (from) rows += '<div class="tt-row"><span>From</span><b>' + esc(from) + '</b></div>';
        if (to) rows += '<div class="tt-row"><span>To</span><b>' + esc(to) + '</b></div>';
        if (!rows) rows = '<div class="tt-row"><span>Spanning</span><b>Ongoing (no known boundary in view)</b></div>';
      }
      document.getElementById('tt-rows').innerHTML = rows;

      var flag = gap ? 'Last working day to commercial start' : (el.getAttribute('data-tip-flag') || '');
      var flagEl = document.getElementById('tt-flag');
      flagEl.textContent = flag; flagEl.hidden = !flag;

      tt.hidden = false; place(e);
    });
    el.addEventListener('mousemove', place);
    el.addEventListener('mouseleave', function(){ tt.hidden = true; });
  });
}

/* ── Controls ────────────────────────────────────────────────────── */
function buildSupplierChips(){
  var host = document.getElementById('supplierChips');
  host.innerHTML = '';
  DATA.suppliers.forEach(function(s){
    var chip = document.createElement('button');
    chip.className = 'chip';
    chip.style.cssText = filterPillStyle(s.colour, state.activeSuppliers.has(s.abbreviation));
    chip.textContent = s.name;
    chip.addEventListener('click', function(){
      if (state.activeSuppliers.has(s.abbreviation)) state.activeSuppliers.delete(s.abbreviation);
      else state.activeSuppliers.add(s.abbreviation);
      syncChips(); render();
    });
    host.appendChild(chip);
  });
}
function syncChips(){
  var chips = document.getElementById('supplierChips').children;
  for (var i = 0; i < chips.length; i++) {
    var abbr = DATA.suppliers[i].abbreviation;
    chips[i].style.cssText = filterPillStyle(DATA.palette[abbr].colour, state.activeSuppliers.has(abbr));
  }
  var allBtn = document.getElementById('allSuppliersBtn');
  allBtn.classList.toggle('inactive', state.activeSuppliers.size !== DATA.suppliers.length);
  var presetBtn = document.getElementById('presetBtn');
  var isFocus = state.activeSuppliers.size === 2 && state.activeSuppliers.has('CG') && state.activeSuppliers.has('TCS');
  presetBtn.classList.toggle('inactive', !isFocus);
}
function buildMonthRow(){
  document.getElementById('monthRow').innerHTML = DATA.months.map(function(m){
    return '<div class="month-cell">' + esc(m.label) + '</div>';
  }).join('');
}
function buildQuarterRow(){
  document.getElementById('quarterRow').innerHTML = DATA.quarters.map(function(q){
    return '<div class="quarter-cell" style="flex:' + q.monthCount + '">' + esc(q.label) + '</div>';
  }).join('');
}
function buildSecondary(){
  var wrap = document.getElementById('secLabelWrap');
  var sel = document.getElementById('secondaryFilter');
  var showPill = document.getElementById('showPill');

  var isCategory = state.groupBy === 'category';
  wrap.style.display = isCategory ? 'none' : '';
  showPill.style.display = isCategory ? 'none' : '';
  if (isCategory) { sel.innerHTML = ''; return; }

  document.getElementById('secLabel').textContent = state.groupBy === 'team' ? 'Skillset' : 'Team';
  var opts = state.groupBy === 'team' ? DATA.disciplines : DATA.teams;
  sel.innerHTML = '<option value="">All</option>' + opts.map(function(o){
    return '<option value="' + esc(o) + '">' + esc(o) + '</option>';
  }).join('');
  sel.value = state.secondaryFilter;
  wrap.classList.toggle('active', state.secondaryFilter !== '');
}
function syncModeButtons(){
  Array.prototype.forEach.call(document.querySelectorAll('#groupToggle button'), function(b){
    b.classList.toggle('active', b.getAttribute('data-group') === state.groupBy);
  });
  Array.prototype.forEach.call(document.querySelectorAll('#transitionToggle button'), function(b){
    var wantsTransition = b.getAttribute('data-mode') === 'transition';
    b.classList.toggle('active', wantsTransition === state.transitionOnly);
  });
  var labels = {team:'Team / Resource', discipline:'Skillset / Resource', category:'Category / Resource'};
  document.getElementById('spacerLabel').textContent = labels[state.groupBy];
}

document.getElementById('groupToggle').addEventListener('click', function(e){
  var btn = e.target.closest('button'); if (!btn) return;
  state.groupBy = btn.getAttribute('data-group');
  state.secondaryFilter = '';
  if (state.groupBy === 'category') state.transitionOnly = false;
  // Every grouping mode starts fully collapsed.
  state.collapsed = new Set(groupNames());
  syncModeButtons(); buildSecondary(); render();
});
document.getElementById('transitionToggle').addEventListener('click', function(e){
  var btn = e.target.closest('button'); if (!btn) return;
  state.transitionOnly = btn.getAttribute('data-mode') === 'transition';
  syncModeButtons(); render();
});
document.getElementById('secondaryFilter').addEventListener('change', function(e){
  state.secondaryFilter = e.target.value;
  document.getElementById('secLabelWrap').classList.toggle('active', state.secondaryFilter !== '');
  render();
});
document.getElementById('presetBtn').addEventListener('click', function(){
  state.activeSuppliers = new Set(['CG','TCS']); syncChips(); render();
});
document.getElementById('allSuppliersBtn').addEventListener('click', function(){
  state.activeSuppliers = new Set(DATA.suppliers.map(function(s){ return s.abbreviation; }));
  syncChips(); render();
});
document.getElementById('expandAllBtn').addEventListener('click', toggleAllGroups);
window.addEventListener('resize', function(){ positionToday(); fitLabels(); });

state.collapsed = new Set(groupNames());
buildMonthRow();
buildQuarterRow();
buildSupplierChips();
syncChips();
buildSecondary();
syncModeButtons();
render();
`
