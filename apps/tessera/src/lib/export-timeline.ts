import { PHASES, TOTAL_MONTHS, MONTH_YEAR_LABELS } from './timeline-utils'

// Resolve CSS variable colours to hardcoded hex/rgba for standalone HTML export
const CSS_VAR_COLOURS: Record<string, string> = {
  'var(--rmg-color-tint-green)': 'rgba(16,185,129,0.08)',
  'var(--rmg-color-green)':      '#059669',
  'var(--rmg-color-blue)':       '#0892CB',
}

function rc(c: string): string {
  return CSS_VAR_COLOURS[c] ?? c
}

export interface ExportResource {
  resource_name: string
  resource_job_title: string | null
  supplier_abbreviation: string
  supplier_colour: string
  startMonth: number
  endMonth: number
  isOngoing: boolean
}

export interface ExportDomainGroup {
  domain: string
  resources: ExportResource[]
}

export function generateExportHTML(domainGroups: ExportDomainGroup[]): string {
  // Phase gradient (hardcoded colours)
  const phaseStops: string[] = []
  let pos = 0
  for (const p of PHASES) {
    const c = rc(p.colour)
    phaseStops.push(`${c} ${pos}%`)
    pos += (p.months / TOTAL_MONTHS) * 100
    phaseStops.push(`${c} ${pos}%`)
  }
  const phaseGradient = `linear-gradient(to right, ${phaseStops.join(',')})`

  // Unique supplier list (preserving insertion order from domain groups)
  const supplierMap = new Map<string, string>()
  for (const g of domainGroups) {
    for (const r of g.resources) {
      if (!supplierMap.has(r.supplier_abbreviation)) {
        supplierMap.set(r.supplier_abbreviation, r.supplier_colour)
      }
    }
  }

  // Embed all domain/resource data as JSON — the ONLY ${} in the script block
  const dataJson = JSON.stringify(domainGroups)

  // Supplier filter pills — data attributes only, no inline handlers
  const defaultActive = new Set(['CG', 'TCS'])
  const supplierPills = [...supplierMap.entries()].map(([abbr, colour]) => {
    const active = defaultActive.has(abbr)
    const pillStyle = active
      ? `border-color:${colour};background:${colour};color:#fff;`
      : `border-color:${colour};background:transparent;color:${colour};`
    return `<button class="pill" data-sup="${abbr}" data-colour="${colour}" style="${pillStyle}">${abbr}<span id="sc-${abbr}" style="margin-left:4px;font-size:10px;opacity:.75;font-weight:400;"></span></button>`
  }).join('\n  ')

  // Phase header cells
  const phaseHeaderCells = PHASES.map((p) => {
    const bg   = rc(p.colour)
    const text = rc(p.textColour)
    return `<th colspan="3" class="ph" style="background:${bg};color:${text};">${p.label}</th>`
  }).join('')

  // Month header cells
  const monthHeaderCells = MONTH_YEAR_LABELS.map((m) => {
    const flag = m.includes('⚑')
    return `<th class="mh" style="font-weight:${flag ? 700 : 400};color:${flag ? '#da202a' : '#888'};">${m}</th>`
  }).join('')

  // Body rows — data-idx for domain, data-sup for supplier, no inline onclick
  const bodyRows: string[] = []
  let domainIdx = 0

  for (const g of domainGroups) {
    if (g.resources.length === 0) continue
    const idx = String(domainIdx++)

    const resourceRows = g.resources.map((r) => {
      const lp  = ((r.startMonth / TOTAL_MONTHS) * 100).toFixed(2)
      const wp  = (((r.endMonth - r.startMonth) / TOTAL_MONTHS) * 100).toFixed(2)
      const nameEsc  = r.resource_name.replace(/"/g, '&quot;')
      const titleEsc = (r.resource_job_title ?? '').replace(/"/g, '&quot;')

      const bar = parseFloat(wp) > 0
        ? `<div style="position:absolute;top:50%;transform:translateY(-50%);left:${lp}%;width:${wp}%;height:14px;background:${r.supplier_colour};opacity:.88;border-radius:${r.isOngoing ? '3px 0 0 3px' : '3px'};pointer-events:none;"></div>` +
          (r.isOngoing
            ? `<div style="position:absolute;top:50%;transform:translateY(-50%);right:0;width:10px;height:14px;opacity:.35;background:repeating-linear-gradient(90deg,${r.supplier_colour} 0,${r.supplier_colour} 2px,transparent 2px,transparent 4px);pointer-events:none;"></div>`
            : '')
        : ''

      const dotHtml = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${r.supplier_colour};vertical-align:middle;margin-right:6px;flex-shrink:0;"></span>`
      const titleHtml = r.resource_job_title
        ? `<span style="color:#bbb;font-size:10px;margin-left:4px;">${r.resource_job_title}</span>`
        : ''

      return `<tr class="rr" data-idx="${idx}" data-sup="${r.supplier_abbreviation}">
        <td class="nc">${dotHtml}${r.resource_name}${titleHtml}</td>
        <td class="bc" colspan="12" style="background:${phaseGradient};height:26px;" data-name="${nameEsc}" data-title="${titleEsc}" data-sup="${r.supplier_abbreviation}">${bar}</td>
      </tr>`
    }).join('\n')

    bodyRows.push(
      `<tr class="dh" data-idx="${idx}">
        <td class="nc dhn"><span class="chev" id="ch-${idx}">&#9660;</span>${g.domain}<span class="cnt" id="cnt-${idx}"></span></td>
        <td class="bc" colspan="12" style="background:${phaseGradient};height:34px;opacity:.45;"></td>
      </tr>
      ${resourceRows}`,
    )
  }

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  // ── Script block ─────────────────────────────────────────────────────────
  // IMPORTANT: zero backticks/template-literals inside this block.
  // The only ${} expression is ${dataJson} which is evaluated by TypeScript
  // before the string is built — it embeds a plain JSON literal into the JS.
  // All other JS uses single-quoted strings and + concatenation only.
  const scriptBlock = `
document.addEventListener('DOMContentLoaded', function() {

  var DATA = ${dataJson};

  /* ── Build supplier colour map from DATA ── */
  var allSuppliers = [];
  var supplierColours = {};
  DATA.forEach(function(g) {
    g.resources.forEach(function(r) {
      var s = r.supplier_abbreviation;
      if (!supplierColours[s]) {
        supplierColours[s] = r.supplier_colour;
        allSuppliers.push(s);
      }
    });
  });

  /* ── Initial selection: CG + TCS (or all if neither exists) ── */
  var selectedSuppliers = new Set();
  ['CG', 'TCS'].forEach(function(s) {
    if (supplierColours[s]) selectedSuppliers.add(s);
  });
  if (selectedSuppliers.size === 0) {
    allSuppliers.forEach(function(s) { selectedSuppliers.add(s); });
  }

  /* ── Sync pill styles to selectedSuppliers ── */
  function syncPills() {
    document.querySelectorAll('.pill').forEach(function(btn) {
      var sup    = btn.getAttribute('data-sup');
      var colour = btn.getAttribute('data-colour');
      if (selectedSuppliers.has(sup)) {
        btn.style.background   = colour;
        btn.style.color        = '#fff';
        btn.style.borderColor  = colour;
      } else {
        btn.style.background   = 'transparent';
        btn.style.color        = colour;
        btn.style.borderColor  = colour;
      }
    });
  }

  /* ── Apply supplier filter to rows ── */
  function applyFilter() {
    document.querySelectorAll('.rr').forEach(function(row) {
      var sup = row.getAttribute('data-sup');
      if (selectedSuppliers.size === 0 || selectedSuppliers.has(sup)) {
        row.classList.remove('sf');
      } else {
        row.classList.add('sf');
      }
    });
    /* Hide domain header when all its resources are filtered out */
    document.querySelectorAll('.dh').forEach(function(dh) {
      var idx  = dh.getAttribute('data-idx');
      var rows = document.querySelectorAll('.rr[data-idx="' + idx + '"]');
      var anyVisible = false;
      rows.forEach(function(r) {
        if (!r.classList.contains('sf')) anyVisible = true;
      });
      dh.style.display = anyVisible ? '' : 'none';
    });
    updateCounts();
  }

  /* ── Update count chips (per-domain and per-supplier) ── */
  function updateCounts() {
    var total    = 0;
    var supCounts = {};
    document.querySelectorAll('.rr').forEach(function(r) {
      if (!r.classList.contains('sf')) {
        var s = r.getAttribute('data-sup');
        supCounts[s] = (supCounts[s] || 0) + 1;
        total++;
      }
    });
    /* Per-supplier chips inside pills */
    document.querySelectorAll('.pill').forEach(function(btn) {
      var sup  = btn.getAttribute('data-sup');
      var chip = document.getElementById('sc-' + sup);
      if (chip) chip.textContent = '(' + (supCounts[sup] || 0) + ')';
    });
    /* Per-domain chips */
    document.querySelectorAll('.dh').forEach(function(row) {
      var idx  = row.getAttribute('data-idx');
      var rows = document.querySelectorAll('.rr[data-idx="' + idx + '"]');
      var vis  = 0;
      rows.forEach(function(r) {
        if (!r.classList.contains('sf')) vis++;
      });
      var c = document.getElementById('cnt-' + idx);
      if (c) c.textContent = '(' + vis + ')';
    });
    /* Total count */
    var tc = document.getElementById('total-count');
    if (tc) tc.textContent = total + ' visible';
  }

  /* ── Pill click: toggle supplier ── */
  document.querySelectorAll('.pill').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var sup = btn.getAttribute('data-sup');
      if (selectedSuppliers.has(sup)) {
        selectedSuppliers.delete(sup);
      } else {
        selectedSuppliers.add(sup);
      }
      syncPills();
      applyFilter();
    });
  });

  /* ── Reset to default (CG + TCS) ── */
  var resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      selectedSuppliers = new Set();
      ['CG', 'TCS'].forEach(function(s) {
        if (supplierColours[s]) selectedSuppliers.add(s);
      });
      if (selectedSuppliers.size === 0) {
        allSuppliers.forEach(function(s) { selectedSuppliers.add(s); });
      }
      syncPills();
      applyFilter();
    });
  }

  /* ── Expand all ── */
  var expandBtn = document.getElementById('expand-all');
  if (expandBtn) {
    expandBtn.addEventListener('click', function() {
      document.querySelectorAll('.dh').forEach(function(row) { row.classList.remove('collapsed'); });
      document.querySelectorAll('.rr').forEach(function(r)   { r.classList.remove('dc'); });
    });
  }

  /* ── Collapse all ── */
  var collapseBtn = document.getElementById('collapse-all');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', function() {
      document.querySelectorAll('.dh').forEach(function(row) { row.classList.add('collapsed'); });
      document.querySelectorAll('.rr').forEach(function(r)   { r.classList.add('dc'); });
    });
  }

  /* ── Domain header click: toggle collapse ── */
  document.querySelectorAll('.dh').forEach(function(row) {
    row.addEventListener('click', function() {
      var idx           = row.getAttribute('data-idx');
      var nowCollapsed  = row.classList.toggle('collapsed');
      document.querySelectorAll('.rr[data-idx="' + idx + '"]').forEach(function(r) {
        if (nowCollapsed) {
          r.classList.add('dc');
        } else {
          r.classList.remove('dc');
        }
      });
    });
  });

  /* ── Hover tooltip on bar cells ── */
  var tip = document.getElementById('tip');
  document.querySelectorAll('.bc').forEach(function(cell) {
    var name = cell.getAttribute('data-name');
    if (!name) return;
    var title  = cell.getAttribute('data-title') || '';
    var sup    = cell.getAttribute('data-sup')   || '';
    cell.addEventListener('mouseenter', function() {
      var html = '<strong>' + name + '</strong>';
      if (title) html = html + '<br><span style="opacity:.75">' + title + '</span>';
      html = html + '<br><span style="opacity:.55;font-size:10px">' + sup + '</span>';
      tip.innerHTML        = html;
      tip.style.display    = 'block';
    });
    cell.addEventListener('mousemove', function(e) {
      tip.style.left = (e.clientX + 16) + 'px';
      tip.style.top  = (e.clientY - 8)  + 'px';
    });
    cell.addEventListener('mouseleave', function() {
      tip.style.display = 'none';
    });
  });

  /* ── Initial render ── */
  syncPills();
  applyFilter();

});
`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Resource Transition Timeline — Tessera</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f5f7;padding:28px;color:#333;}
.pg-title{font-size:1.5rem;font-weight:700;color:#111;margin-bottom:4px;letter-spacing:-.02em;}
.pg-sub{font-size:13px;color:#666;margin-bottom:20px;}
.controls{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center;}
.pill{padding:4px 12px;border-radius:100px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid transparent;transition:background 120ms,color 120ms;}
.sep{width:1px;height:20px;background:#ddd;margin:0 2px;}
.btn{padding:4px 12px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;border:1.5px solid #ccc;background:#fff;color:#444;}
.btn:hover{background:#f5f5f5;}
.chart{overflow-x:auto;background:#fff;border-radius:10px;box-shadow:0 1px 6px rgba(0,0,0,.08);}
table{border-collapse:collapse;min-width:900px;width:100%;}
th,td{padding:0;}
td{border-bottom:1px solid #f0f0f0;}
.nc{width:240px;min-width:240px;max-width:240px;padding:4px 8px 4px 16px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;position:sticky;left:0;z-index:2;background:#fff;border-right:1px solid #e5e7eb;}
thead .nc{background:#f8f8f8;}
thead th{position:sticky;top:0;z-index:3;}
.ph{padding:4px 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;border-right:1px solid rgba(0,0,0,.05);}
.mh{padding:4px 2px;font-size:10px;text-align:center;border-right:1px solid #eee;border-bottom:2px solid #ccc;}
.dh td{background:#f8f8f8!important;cursor:pointer;user-select:none;}
.dhn{font-weight:700;background:#f8f8f8!important;color:#222;display:flex;align-items:center;gap:6px;}
.chev{font-size:8px;color:#aaa;flex-shrink:0;transition:transform 150ms;display:inline-block;}
.dh.collapsed .chev{transform:rotate(-90deg);}
.cnt{font-size:10px;font-weight:400;color:#aaa;}
.bc{position:relative;cursor:default;}
.sf{display:none!important;}
.dc{display:none!important;}
</style>
</head>
<body>
<div class="pg-title">Resource Transition Timeline</div>
<div class="pg-sub">CG &rarr; TCS factory transition &middot; Apr 2026 &ndash; Mar 2027 &middot; Exported from Tessera &middot; ${today}</div>
<div class="controls">
  <span id="total-count" style="font-size:12px;color:#666;white-space:nowrap;"></span>
  <div class="sep"></div>
  ${supplierPills}
  <div class="sep"></div>
  <button id="reset-btn" class="btn">Reset to default</button>
  <div class="sep"></div>
  <button id="expand-all" class="btn">Expand all</button>
  <button id="collapse-all" class="btn">Collapse all</button>
</div>
<div class="chart">
<table>
<thead>
  <tr>
    <th class="nc" style="background:#f8f8f8;border-bottom:1px solid #eee;"></th>
    ${phaseHeaderCells}
  </tr>
  <tr>
    <th class="nc" style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#aaa;background:#f8f8f8;">Resource</th>
    ${monthHeaderCells}
  </tr>
</thead>
<tbody>
${bodyRows.join('\n')}
</tbody>
</table>
</div>
<div id="tip" style="position:fixed;display:none;background:#1a1a2e;color:#fff;padding:8px 12px;border-radius:6px;font-size:11px;line-height:1.5;pointer-events:none;z-index:9999;max-width:260px;box-shadow:0 4px 16px rgba(0,0,0,.25);"></div>
<script>${scriptBlock}</script>
</body>
</html>`
}
