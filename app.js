// Arena 360 — MASTER viewer (vanilla JS)
const COLUMNS = [
  "Hora Início","Hora Fim","Duração (min)","Bloco","Turno","Área","Função","Tarefa",
  "Passos (passo a passo)","Critério de Aceite","Evidência/Registro","Prioridade",
  "Responsável","Status"
].filter(Boolean);

const state = {
  data: [],
  page: 1,
  pageSize: 50,
  sort: { key: "Hora Início", dir: "asc" },
  filters: { q: "", bloco: "", area: "", func: "", turno: "", prio: "", status: "" }
};

const els = {
  q:      document.getElementById("q"),
  bloco:  document.getElementById("f-bloco"),
  area:   document.getElementById("f-area"),
  func:   document.getElementById("f-func"),
  turno:  document.getElementById("f-turno"),
  prio:   document.getElementById("f-prio"),
  status: document.getElementById("f-status"),
  pageSize: document.getElementById("page-size"),
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
  pageInfo: document.getElementById("page-info"),
  head: document.getElementById("grid-head"),
  body: document.getElementById("grid-body"),
  export: document.getElementById("btn-export"),
  print: document.getElementById("btn-print")
};

init();

async function init(){
  const [data, opts] = await Promise.all([
    fetch("data/master.json").then(r=>r.json()),
    fetch("data/options.json").then(r=>r.json()).catch(()=>({}))
  ]);
  state.data = data;

  // Build table head
  const tr = document.createElement("tr");
  COLUMNS.forEach(col => {
    const th = document.createElement("th");
    th.textContent = col;
    th.dataset.key = col;
    th.addEventListener("click", () => onSort(col));
    tr.appendChild(th);
  });
  els.head.appendChild(tr);

  // Fill filters
  fillSelect(els.bloco, opts["Bloco"]);
  fillSelect(els.area, opts["Área"]);
  fillSelect(els.func, opts["Função"]);
  fillSelect(els.turno, opts["Turno"]);
  fillSelect(els.prio, opts["Prioridade"]);
  fillSelect(els.status, opts["Status"]);

  // Bind events
  els.q.addEventListener("input", () => { state.filters.q = els.q.value.trim().toLowerCase(); state.page=1; render(); });
  els.bloco.addEventListener("change", () => { state.filters.bloco = els.bloco.value; state.page=1; render(); });
  els.area.addEventListener("change",  () => { state.filters.area  = els.area.value; state.page=1; render(); });
  els.func.addEventListener("change",  () => { state.filters.func  = els.func.value; state.page=1; render(); });
  els.turno.addEventListener("change", () => { state.filters.turno = els.turno.value; state.page=1; render(); });
  els.prio.addEventListener("change",  () => { state.filters.prio  = els.prio.value; state.page=1; render(); });
  els.status.addEventListener("change",() => { state.filters.status= els.status.value; state.page=1; render(); });
  els.pageSize.addEventListener("change", () => { state.pageSize = parseInt(els.pageSize.value,10)||50; state.page=1; render(); });
  els.prev.addEventListener("click", () => { if(state.page>1){state.page--; render();} });
  els.next.addEventListener("click", () => { state.page++; render(); });
  els.export.addEventListener("click", onExportCSV);
  els.print.addEventListener("click", () => window.print());

  render();
}

function fillSelect(sel, items){
  if(!sel || !Array.isArray(items)) return;
  for(const v of items){
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  }
}

function onSort(col){
  const s = state.sort;
  if(s.key === col){
    s.dir = (s.dir === "asc" ? "desc" : "asc");
  }else{
    s.key = col; s.dir = "asc";
  }
  // update header classes
  for(const th of els.head.querySelectorAll("th")){
    th.classList.remove("sort-asc","sort-desc");
    if(th.dataset.key === s.key){
      th.classList.add(s.dir === "asc" ? "sort-asc" : "sort-desc");
    }
  }
  render();
}

function getFiltered(){
  const {q, bloco, area, func, turno, prio, status} = state.filters;
  const hasQ = q && q.length>0;
  const qRe = hasQ ? new RegExp(escapeRegExp(q), "i") : null;

  return state.data.filter(r => {
    if(bloco && r["Bloco"] !== bloco) return false;
    if(area  && r["Área"]  !== area)  return false;
    if(func  && r["Função"]!== func)  return false;
    if(turno && r["Turno"] !== turno) return false;
    if(prio  && r["Prioridade"] !== prio) return false;
    if(status&& r["Status"] !== status) return false;
    if(hasQ){
      const hay = [
        r["Tarefa"], r["Passos (passo a passo)"], r["Função"],
        r["Evidência/Registro"], r["Critério de Aceite"], r["Responsável"], r["Área"]
      ].map(v=>String(v||"")).join(" | ");
      if(!qRe.test(hay)) return false;
    }
    return true;
  });
}

function render(){
  const filtered = getFiltered();

  // Sort
  const {key, dir} = state.sort;
  filtered.sort((a,b) => cmp(a[key], b[key]) * (dir==="asc" ? 1 : -1));

  // Pagination
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / state.pageSize));
  if(state.page > pages) state.page = pages;
  const start = (state.page-1)*state.pageSize;
  const pageRows = filtered.slice(start, start + state.pageSize);

  // Render rows
  els.body.innerHTML = "";
  for(const r of pageRows){
    const tr = document.createElement("tr");
    for(const c of COLUMNS){
      const td = document.createElement("td");
      td.textContent = r[c] ?? "";
      tr.appendChild(td);
    }
    els.body.appendChild(tr);
  }

  els.pageInfo.textContent = `Página ${state.page} de ${pages} • ${total} itens`;
}

function cmp(a,b){
  // try HH:MM
  const tA = parseTime(a), tB = parseTime(b);
  if(tA!=null && tB!=null) return tA - tB;
  // numeric
  const nA = parseFloat(a), nB = parseFloat(b);
  if(!Number.isNaN(nA) && !Number.isNaN(nB)) return nA - nB;
  // string
  const sA = String(a||"").toLowerCase(), sB = String(b||"").toLowerCase();
  if(sA < sB) return -1;
  if(sA > sB) return 1;
  return 0;
}

function parseTime(v){
  if(typeof v!=="string") return null;
  const m = v.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if(!m) return null;
  return parseInt(m[1],10)*60 + parseInt(m[2],10);
}

function escapeRegExp(s){
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function onExportCSV(){
  const rows = getFiltered();
  const cols = COLUMNS;
  let csv = cols.join(";") + "\n";
  for(const r of rows){
    const line = cols.map(c => {
      const val = String(r[c] ?? "").replace(/"/g,'""');
      // wrap if has separator or newline
      return /[;\n"]/.test(val) ? `"${val}"` : val;
    }).join(";");
    csv += line + "\n";
  }
  const blob = new Blob([new TextEncoder().encode(csv)], {type: "text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "arena360_master.csv";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
