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

  const allSupplierJson = JSON.stringify([...supplierMap.keys()])

  // Supplier filter pills
  const supplierPills = [...supplierMap.entries()].map(([abbr, colour]) =>
    `<button class="pill" data-s="${abbr}" style="border-color:${colour};background:${colour};color:#fff;" onclick="toggleSupplier('${abbr}','${colour}')">${abbr}</button>`,
  ).join('\n  ')

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

  // Body rows
  const bodyRows: string[] = []
  let domainIdx = 0

  for (const g of domainGroups) {
    if (g.resources.length === 0) continue
    const id = String(domainIdx++)

    const resourceRows = g.resources.map((r) => {
      const lp = ((r.startMonth / TOTAL_MONTHS) * 100).toFixed(2)
      const wp = (((r.endMonth - r.startMonth) / TOTAL_MONTHS) * 100).toFixed(2)
      const title = r.resource_job_title
        ? `${r.resource_name} — ${r.resource_job_title}`
        : r.resource_name

      const bar = parseFloat(wp) > 0
        ? `<div style="position:absolute;top:50%;transform:translateY(-50%);left:${lp}%;width:${wp}%;height:14px;background:${r.supplier_colour};opacity:.88;border-radius:${r.isOngoing ? '3px 0 0 3px' : '3px'};"></div>` +
          (r.isOngoing
            ? `<div style="position:absolute;top:50%;transform:translateY(-50%);right:0;width:10px;height:14px;opacity:.35;background:repeating-linear-gradient(90deg,${r.supplier_colour} 0,${r.supplier_colour} 2px,transparent 2px,transparent 4px);"></div>`
            : '')
        : ''

      return `<tr class="rr" data-d="${id}" data-s="${r.supplier_abbreviation}">
        <td class="nc" title="${title}">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${r.supplier_colour};vertical-align:middle;margin-right:6px;flex-shrink:0;"></span>${r.resource_name}${r.resource_job_title ? `<span style="color:#bbb;font-size:10px;margin-left:4px;">${r.resource_job_title}</span>` : ''}
        </td>
        <td class="bc" colspan="12" style="background:${phaseGradient};height:26px;">${bar}</td>
      </tr>`
    }).join('\n')

    bodyRows.push(
      `<tr class="dh" data-d="${id}" onclick="toggleDomain('${id}')">
        <td class="nc dhn">
          <span class="chev" id="ch-${id}">▼</span>${g.domain}<span class="cnt" id="cnt-${id}"></span>
        </td>
        <td class="bc dh-bar" colspan="12" style="background:${phaseGradient};height:34px;opacity:.45;"></td>
      </tr>
      ${resourceRows}`,
    )
  }

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

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
.pill.off{background:transparent!important;}
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
.chev.collapsed{transform:rotate(-90deg);}
.cnt{font-size:10px;font-weight:400;color:#aaa;}
.bc{position:relative;}
.supplier-hidden,.domain-hidden{display:none!important;}
</style>
</head>
<body>
<div class="pg-title">Resource Transition Timeline</div>
<div class="pg-sub">CG &rarr; TCS factory transition &middot; Apr 2026 &ndash; Mar 2027 &middot; Exported from Tessera &middot; ${today}</div>
<div class="controls">
  ${supplierPills}
  <div class="sep"></div>
  <button class="btn" onclick="expandAll()">Expand all</button>
  <button class="btn" onclick="collapseAll()">Collapse all</button>
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
<script>
var collapsed=new Set();
var active=new Set(${allSupplierJson});
function updateCounts(){
  document.querySelectorAll('.dh').forEach(function(row){
    var id=row.dataset.d;
    var vis=0;
    document.querySelectorAll('.rr[data-d="'+id+'"]').forEach(function(r){
      if(!r.classList.contains('supplier-hidden'))vis++;
    });
    var c=document.getElementById('cnt-'+id);
    if(c)c.textContent='('+vis+')';
    row.style.display=vis===0?'none':'';
  });
}
function toggleDomain(id){
  var rows=document.querySelectorAll('.rr[data-d="'+id+'"]');
  var ch=document.getElementById('ch-'+id);
  if(collapsed.has(id)){
    collapsed.delete(id);
    rows.forEach(function(r){r.classList.remove('domain-hidden');});
    if(ch)ch.classList.remove('collapsed');
  }else{
    collapsed.add(id);
    rows.forEach(function(r){r.classList.add('domain-hidden');});
    if(ch)ch.classList.add('collapsed');
  }
}
function expandAll(){
  collapsed.clear();
  document.querySelectorAll('.rr').forEach(function(r){r.classList.remove('domain-hidden');});
  document.querySelectorAll('.chev').forEach(function(c){c.classList.remove('collapsed');});
}
function collapseAll(){
  document.querySelectorAll('.dh').forEach(function(row){collapsed.add(row.dataset.d);});
  document.querySelectorAll('.rr').forEach(function(r){r.classList.add('domain-hidden');});
  document.querySelectorAll('.chev').forEach(function(c){c.classList.add('collapsed');});
}
function toggleSupplier(abbr,colour){
  if(active.has(abbr)){
    active.delete(abbr);
    document.querySelectorAll('.rr[data-s="'+abbr+'"]').forEach(function(r){r.classList.add('supplier-hidden');});
    var btn=document.querySelector('.pill[data-s="'+abbr+'"]');
    if(btn){btn.classList.add('off');btn.style.color=colour;}
  }else{
    active.add(abbr);
    document.querySelectorAll('.rr[data-s="'+abbr+'"]').forEach(function(r){r.classList.remove('supplier-hidden');});
    var btn=document.querySelector('.pill[data-s="'+abbr+'"]');
    if(btn){btn.classList.remove('off');btn.style.color='#fff';}
  }
  updateCounts();
}
updateCounts();
</script>
</body>
</html>`
}
