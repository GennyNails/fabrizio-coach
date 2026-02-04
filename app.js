
// Versione + chiave storage: cambiando chiave si parte da ZERO (nessun dato vecchio)
const APP_VERSION = "2.0";
const STORE_KEY = "mister_soccer_v28";

const CATEGORIES = ["Primi Calci", "Piccoli Amici", "Pulcini 1° anno", "Pulcini 2° anno", "Pulcini Misti", "Esordienti 1° Anno", "Esordienti 2° Anno", "Esordienti Misti", "Giovanissimi (U14)", "Giovanissimi (U15)", "Allievi"];

const PLACEHOLDER_PHOTO = "placeholder.png";

const PHOTO_MAP = {"BATTAGLIA RICCARDO": "photos/riccardo.jpg", "ZULIANI EVAN": "photos/evan.jpg", "MARKU OREST": "photos/orest.jpg", "GHIRARDO GABRIEL": "photos/gabriel.jpg", "BENMIMOUN AMIR": "photos/amir.jpg", "GHIRARDO GIANMARIA": "photos/gianmaria.jpg", "CASONATO CHRISTIAN": "photos/christian.jpg", "DE GIUSTI GIACOMO": "photos/giacomo.jpg", "BENMIMOUN HEDI": "photos/hedi.jpg", "SONEGO LEONARDO": "photos/leonardo.jpg", "BURIOLA ELIA": "photos/elia.jpg", "HALLULLI LEON": "photos/leon.jpg", "GUZ PATRICK": "photos/patrick.jpg"};
const LEGACY_KEYS = [];
const ROLES = ["portiere","difensore","centrocampista","ala sx","ala destra","attaccante"];
const DEFAULT_ROSTER = [{"name": "BATTAGLIA RICCARDO", "roles": ["centrocampista"], "number": ""}, {"name": "BENMIMOUN AMIR", "roles": ["centrocampista"], "number": ""}, {"name": "BENMIMOUN HEDI", "roles": ["centrocampista"], "number": ""}, {"name": "BURIOLA ELIA", "roles": ["centrocampista"], "number": ""}, {"name": "CASONATO CHRISTIAN", "roles": ["centrocampista"], "number": ""}, {"name": "DE GIUSTI GIACOMO", "roles": ["centrocampista"], "number": ""}, {"name": "GHIRARDO GABRIEL", "roles": ["centrocampista"], "number": ""}, {"name": "GHIRARDO GIANMARIA", "roles": ["centrocampista"], "number": ""}, {"name": "GUZ PATRICK", "roles": ["centrocampista"], "number": ""}, {"name": "HALLULLI LEON", "roles": ["centrocampista"], "number": ""}, {"name": "MARKU OREST", "roles": ["centrocampista"], "number": ""}, {"name": "SONEGO LEONARDO", "roles": ["centrocampista"], "number": ""}, {"name": "ZULIANI EVAN", "roles": ["centrocampista"], "number": ""}];

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function monthISO(dateISO) { return (dateISO || "").slice(0,7); }
function getPlayerByName(name){ return state.roster.find(p=>p.name===name) || null; }
function numberForPlayer(name){ const p=getPlayerByName(name); return p && p.number ? String(p.number) : ""; }

function photoForPlayer(name){
  let src = null;
  try{
    if(state && state.playerPhotos && state.playerPhotos[name]) src = state.playerPhotos[name];
  }catch(e){}
  if(!src && PHOTO_MAP && PHOTO_MAP[name]) src = PHOTO_MAP[name];
  if(!src) src = PLACEHOLDER_PHOTO;
  // cache-bust per Vercel/GitHub
  if(typeof src === "string" && !src.startsWith("data:") && !src.startsWith("blob:")){
    const sep = src.includes("?") ? "&" : "?";
    src = src + sep + "v=" + encodeURIComponent(APP_VERSION);
  }
  return src;
}


function uid() { return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()); }

function migrateLegacyIfAny(){
  // Migrazione automatica disattivata: partiamo da zero.
  return null;
}

function normalizeRoster(){
  state.roster = state.roster.map(p=>{
    const out = {...p};
    if(!Array.isArray(out.roles)) out.roles = out.role ? [out.role] : (out.roles||["centrocampista"]);
    out.roles = out.roles.filter(Boolean).slice(0,2);
    if(out.roles.length===0) out.roles=["centrocampista"]; 
    if(out.number===undefined) out.number = "";
    delete out.role;
    return out;
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const legacy = migrateLegacyIfAny();
      if (legacy) return legacy;
      return { roster: structuredClone(DEFAULT_ROSTER), attendance: {}, matches: [], playerPhotos: {} };
    }
    const s = JSON.parse(raw);

    // roster: array string -> array obj
    if (Array.isArray(s.roster) && s.roster.length && typeof s.roster[0] === "string") {
      s.roster = s.roster.map(n => ({ name:n, role:"centrocampista" }));
    }
    if (!Array.isArray(s.roster)) s.roster = structuredClone(DEFAULT_ROSTER);

    // normalizza role
    for (const p of s.roster) {
      if (!p.role || !ROLES.includes(p.role)) p.role = "centrocampista";
    }

    if (!s.attendance || typeof s.attendance !== "object") s.attendance = {};
    if (!Array.isArray(s.matches)) s.matches = [];

    // player photos
    if (!s.playerPhotos || typeof s.playerPhotos !== "object") s.playerPhotos = {};

    // Normalizza roster: role -> roles[], numero
    for (const p of s.roster) {
      if (Array.isArray(p.roles)) {
        // ok
      } else if (p.role && typeof p.role === "string") {
        p.roles = [p.role];
      } else {
        p.roles = ["centrocampista"];
      }
      if (!p.number) p.number = "";
      // pulizia vecchio campo
      if (p.role) delete p.role;
    }

    return s;
  } catch {
    return { roster: structuredClone(DEFAULT_ROSTER), attendance: {}, matches: [], playerPhotos: {} };
  }
}

function saveState() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

function rosterNames() { return state.roster.map(p => p.name); }
function escapeHtml(str) {
  return (str ?? "").toString()
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function formatDateLong(iso){
  // iso: YYYY-MM-DD
  if(!iso) return "—";
  try{
    const [y,m,d]=iso.split("-").map(Number);
    const dt = new Date(y, (m||1)-1, d||1);
    return dt.toLocaleDateString("it-IT", { weekday:"short", day:"2-digit", month:"2-digit" });
  }catch(e){
    return iso;
  }
}


// ----------------- STATE -----------------
let state = loadState();
normalizeRoster();
  if(!state.profile) state.profile = { coachName:"", category: CATEGORIES[0] };
  if(typeof state.teamLogo !== "string") state.teamLogo = "";
  if(!state.playerPhotos || typeof state.playerPhotos !== "object") state.playerPhotos = {};


let selectedSessionId = null;
let attendanceDirty = false;
// ----------------- UI refs -----------------
function toast(msg){
  const d=document.createElement("div");
  d.textContent=msg;
  d.style.position="fixed";d.style.left="50%";d.style.bottom="18px";d.style.transform="translateX(-50%)";
  d.style.padding="10px 14px";d.style.background="rgba(0,0,0,.75)";d.style.color="#d7ffe6";
  d.style.border="1px solid rgba(255,255,255,.15)";d.style.borderRadius="999px";d.style.zIndex=9999;
  d.style.backdropFilter="blur(8px)";
  document.body.appendChild(d);
  setTimeout(()=>{d.style.opacity="0";d.style.transition="opacity .25s";}, 900);
  setTimeout(()=>d.remove(), 1200);
}


function updateSaveAttendanceUI(){
  if(!el.saveAttendanceBtn) return;
  el.saveAttendanceBtn.textContent = attendanceDirty ? "Salva *" : "Salva";
}

function bindTap(elm, fn){
  if(!elm) return;
  const handler = (e)=>{ try{ e.preventDefault(); }catch{} fn(); };
  elm.addEventListener("click", handler);
  elm.addEventListener("touchend", handler, {passive:false});
  elm.addEventListener("pointerup", handler);
}

function refreshDynamicEls(){
  // elements that might be injected later
  el.playerModal = document.getElementById('playerModal');
  el.playerModalTitle = document.getElementById('playerModalTitle');
  el.playerModalBody = document.getElementById('playerModalBody');
  el.playerModalClose = document.getElementById('playerModalClose');
}

const el = {
  pillInfo: document.getElementById("pillInfo"),
  tabButtons: Array.from(document.querySelectorAll(".tabbtn")),
  tabPresenze: document.getElementById("tab-presenze"),
  tabRosa: document.getElementById("tab-rosa"),
  tabPartite: document.getElementById("tab-partite"),  tabTattiche: document.getElementById("tab-tattiche"),
  // La pagina report non esiste più in questa versione, ma lasciamo una guardia per evitare crash.
  tabReport: document.getElementById("tab-report"),

  // Presenze
  monthPick: document.getElementById("monthPick"),
  yearPick: document.getElementById("yearPick"),
  sessionPick: document.getElementById("sessionPick"),
  sessionChecklist: document.getElementById("sessionChecklist"),
  saveAttendanceBtn: document.getElementById("saveAttendanceBtn"),
  monthTotalBadge: document.getElementById("monthTotalBadge"),
  percentTbody: document.getElementById("percentTbody"),
  printMonthBtn: document.getElementById("printMonthBtn"),

  // Rosa
  newPlayerName: document.getElementById("newPlayerName"),
  newPlayerRole: document.getElementById("newPlayerRole"),
  addPlayerBtn: document.getElementById("addPlayerBtn"),
  resetRosterBtn: document.getElementById("resetRosterBtn"),
  rosterList: document.getElementById("rosterList"),
  teamLogoImg: document.getElementById("teamLogoImg"),
  teamLogoFile: document.getElementById("teamLogoFile"),
  coachNameInput: document.getElementById("coachNameInput"),
  categorySelect: document.getElementById("categorySelect"),
  saveProfileBtn: document.getElementById("saveProfileBtn"),
  brandTitle: document.getElementById("brandTitle"),
  brandSubtitle: document.getElementById("brandSubtitle"),
  playerModal: document.getElementById("playerModal"),
  playerModalTitle: document.getElementById("playerModalTitle"),
  playerModalBody: document.getElementById("playerModalBody"),
  playerModalClose: document.getElementById("playerModalClose"),
  newPlayerAvatar: document.getElementById("newPlayerAvatar"),
  newPlayerPhoto: document.getElementById("newPlayerPhoto"),
  clearNewPlayerPhotoBtn: document.getElementById("clearNewPlayerPhotoBtn"),

  // Partite
  matchDate: document.getElementById("matchDate"),
  opponent: document.getElementById("opponent"),
  captainSelect: document.getElementById("captainSelect"),
  viceSelect: document.getElementById("viceSelect"),
  t1: document.getElementById("t1"),
  t2: document.getElementById("t2"),
  t3: document.getElementById("t3"),
  t4: document.getElementById("t4"),
  matchNotes: document.getElementById("matchNotes"),
  saveMatchBtn: document.getElementById("saveMatchBtn"),
  resetMatchBtn: document.getElementById("resetMatchBtn"),
  matchesTbody: document.getElementById("matchesTbody"),
  noMatches: document.getElementById("noMatches"),

  // Report
  playerSearch: document.getElementById("playerSearch"),
  playerList: document.getElementById("playerList"),
  clearPlayerSearchBtn: document.getElementById("clearPlayerSearchBtn"),
  reportMode: document.getElementById("reportMode"),
  reportMonthWrap: document.getElementById("reportMonthWrap"),
  reportMonth: document.getElementById("reportMonth"),
  monthlyYearPick: document.getElementById("monthlyYearPick"),
  monthlyReportMonth: document.getElementById("monthlyReportMonth"),
  printMonthlyPdfBtn: document.getElementById("printMonthlyPdfBtn"),
  playerReport: document.getElementById("playerReport"),
  reportContent: document.getElementById("reportContent"),

  // Tattiche
  tacticsCanvas: document.getElementById("tacticsCanvas"),
  toolDraw: document.getElementById("toolDraw"),
  toolErase: document.getElementById("toolErase"),
  toolMove: document.getElementById("toolMove"),
  toolText: document.getElementById("toolText"),
  toolDelete: document.getElementById("toolDelete"),
  toolClear: document.getElementById("toolClear"),
  toolFullscreen: document.getElementById("tacticsFullscreenBtn"),
  bench: document.getElementById("bench"),
  selectedToken: document.getElementById("selectedToken"),
};

// ----------------- Tabs -----------------
function showTab(which) {
  el.tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === which));
  el.tabPresenze.classList.toggle("hidden", which !== "presenze");
  el.tabRosa.classList.toggle("hidden", which !== "rosa");
  el.tabPartite.classList.toggle("hidden", which !== "partite");
  if (el.tabReport) el.tabReport.classList.toggle("hidden", which !== "report");
  el.tabTattiche.classList.toggle("hidden", which !== "tattiche");
  if (which === "tattiche") tacticsRenderAll();
}
el.tabButtons.forEach(btn => btn.addEventListener("click", () => showTab(btn.dataset.tab)));


// ----------------- PRESENZE: tabella mese (Lun/Mer/Gio) -----------------
function getSelectedMonth() { return el.monthPick?.value || monthISO(todayISO()); }

function pad2(n){ return String(n).padStart(2,"0"); }

function monthTrainingDates(month){
  // month: YYYY-MM, include LUN(1) MER(3) GIO(4)
  const [Y,M] = month.split("-").map(Number);
  const d = new Date(Y, (M||1)-1, 1);
  const out = [];
  while (d.getMonth() === (M-1)) {
    const dow = d.getDay();
    if (dow === 1 || dow === 3 || dow === 4) {
      out.push(`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`);
    }
    d.setDate(d.getDate()+1);
  }
  return out;
}

function ensureAttendanceShape(){
  // stato nuovo: attendance = { "YYYY-MM-DD": { "NOME": true, ... }, ... }
  if(!state.attendance || typeof state.attendance !== "object") state.attendance = {};
  // migra vecchio formato (month -> sessions[])
  for(const k of Object.keys(state.attendance)){
    const v = state.attendance[k];
    if(k.length===7 && v && typeof v === "object" && Array.isArray(v.sessions)){
      // legacy month
      for(const s of v.sessions){
        if(!s || !s.date) continue;
        if(!state.attendance[s.date] || typeof state.attendance[s.date] !== "object") state.attendance[s.date] = {};
        const marks = s.marks || {};
        for(const [name,mark] of Object.entries(marks)){
          if(mark === "P") state.attendance[s.date][name] = true;
        }
      }
      delete state.attendance[k];
    }
  }
}

function getPresentMap(dateISO){
  if(!state.attendance[dateISO] || typeof state.attendance[dateISO] !== "object") state.attendance[dateISO] = {};
  return state.attendance[dateISO];
}

function setPresent(dateISO, playerName, isPresent){
  const m = getPresentMap(dateISO);
  if(isPresent) m[playerName] = true;
  else delete m[playerName];
  // se rimane vuoto, puliamo per tenere leggero
  if(Object.keys(m).length===0) delete state.attendance[dateISO];
  attendanceDirty = true;
  updateSaveAttendanceUI();
}

function weekdayShort(dateISO){
  try{
    const [y,mo,da]=dateISO.split("-").map(Number);
    const dt=new Date(y,(mo||1)-1,da||1);
    return dt.toLocaleDateString("it-IT",{weekday:"short"});
  }catch{ return ""; }
}


function renderAttendanceUI(){
  ensureAttendanceShape();
  const month = getSelectedMonth();
  const dates = monthTrainingDates(month);
  if(el.monthTotalBadge) el.monthTotalBadge.textContent = String(dates.length);

  // populate session dropdown
  if(el.sessionPick){
    const prev = el.sessionPick.value;
    el.sessionPick.innerHTML = "";
    if(!dates.length){
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Nessun allenamento nel mese";
      el.sessionPick.appendChild(opt);
      el.sessionPick.value = "";
    }else{
      // placeholder visibile (utile su mobile)
      const ph = document.createElement("option");
      ph.value = "";
      ph.textContent = "Seleziona giornata";
      el.sessionPick.appendChild(ph);
      for(const d of dates){
        const opt = document.createElement("option");
        opt.value = d;
        const dd = d.slice(8,10);
        const mm = d.slice(5,7);
        const wk = weekdayShort(d);
        opt.textContent = `${wk} ${dd}/${mm}`;
        el.sessionPick.appendChild(opt);
      }
      // keep previous selection if still in month
      el.sessionPick.value = dates.includes(prev) ? prev : dates[0];
    }
  }

  renderSessionChecklist();
  renderPercentages();
}

function renderSessionChecklist(){
  ensureAttendanceShape();
  const date = el.sessionPick?.value || "";
  if(!el.sessionChecklist) return;

  if(!date){
    el.sessionChecklist.innerHTML = `<div class="muted center" style="padding:14px;">Seleziona un mese con allenamenti.</div>`;
    return;
  }

  const dayStore = state.attendance[date] || {};
  const frag = document.createDocumentFragment();

  for(const name of rosterNames()){
    const id = "att_" + hashId(date + "_" + name);
    const wrap = document.createElement("div");
    wrap.className = "checkitem";
    wrap.innerHTML = `
      <label for="${id}">
        <input type="checkbox" id="${id}" data-player="${escapeAttr(name)}" ${dayStore[name] ? "checked" : ""}>
        <span class="checkname">${escapeHtml(name)}</span>
      </label>
    `;
    frag.appendChild(wrap);
  }

  el.sessionChecklist.innerHTML = "";
  el.sessionChecklist.appendChild(frag);

  // mark dirty on change
  el.sessionChecklist.querySelectorAll("input[type=checkbox]").forEach(cb=>{
    cb.addEventListener("change", ()=>{
      attendanceDirty = true; updateSaveAttendanceUI();
      renderPercentages();
    }, {passive:true});
  });

  attendanceDirty = false; updateSaveAttendanceUI();
}

function saveSelectedSession(){
  ensureAttendanceShape();
  const date = el.sessionPick?.value || "";
  if(!date || !el.sessionChecklist) return;

  const present = {};
  el.sessionChecklist.querySelectorAll("input[type=checkbox]").forEach(cb=>{
    const player = cb.getAttribute("data-player") || "";
    if(cb.checked) present[player] = true;
  });
  state.attendance[date] = present;
  saveState();
  attendanceDirty = false; updateSaveAttendanceUI();
  renderPercentages();
}




function saveAttendanceMonth(){
  saveSelectedSession();
  toast("Salvato ✅");
}

function renderPercentages(){
  ensureAttendanceShape();
  const month = getSelectedMonth();
  const dates = monthTrainingDates(month);
  const total = dates.length;

  if(!el.percentTbody) return;
  el.percentTbody.innerHTML = "";

  for(const name of rosterNames()){
    let present = 0;
    for(const d of dates){
      if(state.attendance[d] && state.attendance[d][name]) present++;
    }
    const absent = Math.max(0, total - present);
    const pct = total ? Math.round((present/total)*100) : 0;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(name)}</td>
      <td class="right">${present}</td>
      <td class="right">${absent}</td>
      <td class="right">${total}</td>
      <td class="right"><span class="badge ${pct>=75 ? "ok" : ""}">${pct}%</span></td>
    `;
    el.percentTbody.appendChild(tr);
  }
}

function renderPresenzeAll(){
  renderAttendanceUI();
  renderPercentages();
}

// ----------------- REPORT MENSILE + PRINT -----------------
const MONTH_NAMES_IT = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

function populateYearSelect(sel, selectedYear){
  if(!sel) return;
  const nowY = new Date().getFullYear();
  const years = [];
  for(let y=nowY-4; y<=nowY+1; y++) years.push(y);
  // also include years present in attendance data
  try{
    const keys = Object.keys(state.attendance||{});
    for(const k of keys){
      const y = Number(String(k).slice(0,4));
      if(y && !years.includes(y)) years.push(y);
    }
  }catch{}
  years.sort((a,b)=>a-b);
  sel.innerHTML = "";
  for(const y of years){
    const opt=document.createElement("option");
    opt.value=String(y);
    opt.textContent=String(y);
    sel.appendChild(opt);
  }
  sel.value = String(selectedYear || nowY);
}

function populateMonthSelect(sel, year, preferredMonth){
  if(!sel) return;
  const y = Number(year) || new Date().getFullYear();
  const now = new Date();
  const defaultM = preferredMonth || (y===now.getFullYear() ? (now.getMonth()+1) : 1);
  const keep = sel.value && String(sel.value).startsWith(String(y)+"-") ? Number(String(sel.value).slice(5,7)) : null;

  sel.innerHTML = "";
  for(let m=1; m<=12; m++){
    const opt=document.createElement("option");
    opt.value = `${y}-${pad2(m)}`;
    opt.textContent = `${MONTH_NAMES_IT[m-1]}`;
    sel.appendChild(opt);
  }
  sel.value = `${y}-${pad2(keep || defaultM)}`;
}

function setMonthInputDefaults(){
  const now = new Date();
  const y = now.getFullYear();
  populateYearSelect(el.yearPick, y);
  populateMonthSelect(el.monthPick, el.yearPick?.value || y, now.getMonth()+1);

  populateYearSelect(el.monthlyYearPick, y);
  populateMonthSelect(el.monthlyReportMonth, el.monthlyYearPick?.value || y, now.getMonth()+1);
}

function renderMonthlyReport(){
  ensureAttendanceShape();
  if(!el.monthlyReportArea) return;

  const month = (monthOverride || el.monthlyReportMonth?.value || monthISO(todayISO()));
  const dates = monthTrainingDates(month);
  const total = dates.length;

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="muted" style="margin-bottom:8px;">Mese: <b>${escapeHtml(month)}</b> · Allenamenti: <b>${total}</b></div>
  `;

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>Giocatore</th>
        <th class="right">Pres.</th>
        <th class="right">Ass.</th>
        <th class="right">%</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tb = table.querySelector("tbody");

  for(const name of rosterNames()){
    let present=0;
    for(const d of dates){
      if(state.attendance[d] && state.attendance[d][name]) present++;
    }
    const absent = Math.max(0,total-present);
    const pct = total ? Math.round((present/total)*100) : 0;

    const tr=document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(name)}</td>
      <td class="right">${present}</td>
      <td class="right">${absent}</td>
      <td class="right"><span class="badge ${pct>=75?"ok":""}">${pct}%</span></td>
    `;
    tb.appendChild(tr);
  }

  wrap.appendChild(table);
  el.monthlyReportArea.innerHTML = "";
  el.monthlyReportArea.appendChild(wrap);
}

function printMonthlyPdf(monthOverride){
  ensureAttendanceShape();
  const month = (monthOverride || el.monthlyReportMonth?.value || monthISO(todayISO()));
  const dates = monthTrainingDates(month);
  const total = dates.length;
  const coach = (state.profile?.coachName || "").trim() || "—";
  const cat = (state.profile?.category || "").trim() || "—";

  // build print HTML
  let rows = "";
  for(const name of rosterNames()){
    let present=0;
    for(const d of dates){
      if(state.attendance[d] && state.attendance[d][name]) present++;
    }
    const absent = Math.max(0,total-present);
    const pct = total ? Math.round((present/total)*100) : 0;
    rows += `<tr><td>${escapeHtml(name)}</td><td class="r">${present}</td><td class="r">${absent}</td><td class="r">${total}</td><td class="r">${pct}%</td></tr>`;
  }

  const html = `<!doctype html>
  <html><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Report Presenze ${month}</title>
  <style>
    body{ font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial; padding:18px; color:#111; }
    h1{ font-size:18px; margin:0 0 8px; }
    .meta{ margin:0 0 14px; font-size:13px; }
    table{ width:100%; border-collapse:collapse; font-size:13px; }
    th,td{ border:1px solid #ddd; padding:8px; }
    th{ background:#f5f5f5; text-align:left; }
    .r{ text-align:right; }
    .small{ font-size:12px; color:#444; }
  </style></head>
  <body>
    <h1>Report Presenze — ${escapeHtml(month)}</h1>
    <div class="meta">Coach: <b>${escapeHtml(coach)}</b> · Categoria: <b>${escapeHtml(cat)}</b> · Allenamenti nel mese: <b>${total}</b></div>
    <table>
      <thead><tr><th>Giocatore</th><th class="r">Pres.</th><th class="r">Ass.</th><th class="r">Tot.</th><th class="r">%</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="small" style="margin-top:12px;">Suggerimento: nella finestra di stampa scegli “Salva come PDF”.</p>
    <script>window.onload=()=>{ setTimeout(()=>window.print(), 200); };</script>
  </body></html>`;

  // Try popup first (desktop friendly), fallback to hidden iframe (mobile friendly)
  let w = null;
  try{ w = window.open("", "_blank"); }catch{}
  if(w){
    w.document.open();
    w.document.write(html);
    w.document.close();
    return;
  }

  // Fallback: iframe print (works even with popup blockers)
  const iframe = document.createElement("iframe");
  iframe.style.position="fixed";
  iframe.style.right="0";
  iframe.style.bottom="0";
  iframe.style.width="0";
  iframe.style.height="0";
  iframe.style.border="0";
  iframe.srcdoc = html;
  document.body.appendChild(iframe);
  iframe.onload = ()=>{
    try{
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }catch(e){
      alert("Stampa non disponibile: prova da Chrome/Safari e abilita la stampa.");
    }
    setTimeout(()=>iframe.remove(), 2000);
  };

}

function printPresenzeMonthPdf(){
  const month = getSelectedMonth();
  printMonthlyPdf(month);
}
// ----------------- ROSA -----------------
function fillRoleSelect(sel, value, allowBlank) {
  sel.innerHTML = "";
  if (allowBlank) {
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "—";
    sel.appendChild(o);
  }
  for (const r of ROLES) {
    const o = document.createElement("option");
    o.value = r;
    o.textContent = r;
    if (r === value) o.selected = true;
    sel.appendChild(o);
  }
}

function renderRoster() {
  if (!el.rosterList) return;
  el.rosterList.innerHTML = "";
  if (el.pillInfo) el.pillInfo.textContent = `Rosa: ${state.roster.length}`;

  // datalist (opzionale)
  if (el.playerList) {
    el.playerList.innerHTML = "";
    for (const n of rosterNames()) {
      const opt = document.createElement("option");
      opt.value = n;
      el.playerList.appendChild(opt);
    }
  }

  // capitano/vice e panchina tattiche
  if (el.captainSelect && el.viceSelect) renderCaptainViceOptions();
  if (el.bench) renderBench();

  state.roster.forEach(p => {
    const item = document.createElement("div");
    item.className = "list-item";

    const src = photoForPlayer(p.name);

    item.innerHTML = `
      <div style="display:flex;gap:12px;align-items:flex-start;min-width:0;">
        ${src ? `<img class="avatar clickable" src="${src}" alt="" onerror="this.style.display='none';" />` : ``}
        <div style="min-width:0;flex:1;">
          <div class="title" style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
            <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(p.name)}</span>
            <span class="pill" style="font-size:12px;"># <span data-numPreview>${escapeHtml(String(p.number||""))}</span></span>
          </div>

          <div class="muted" style="margin-top:6px;">Ruoli (max 2) + Numero</div>

          <div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div><select data-role1></select></div>
            <div><select data-role2></select></div>
            <div style="grid-column:1 / -1;display:flex;gap:10px;align-items:center;">
              <input class="input" data-number inputmode="numeric" placeholder="Numero maglia (es. 7)" style="flex:1;min-width:0;" value="${escapeHtml(String(p.number||""))}">
              <button class="btn small" data-save>Salva</button>
              <button class="btn small danger" data-del>Rimuovi</button>
            </div>
          </div>

          <div class="muted" style="margin-top:8px;">Suggerimento: lascia il 2° ruolo vuoto se non serve.</div>
        </div>
      </div>
    `;

    const role1 = item.querySelector("select[data-role1]");
    const role2 = item.querySelector("select[data-role2]");
    const numInput = item.querySelector("input[data-number]");
    const numPrev = item.querySelector("[data-numPreview]");
    const av = item.querySelector("img.avatar");
    if(av){ av.classList.add("clickable"); bindTap(av, ()=> openPlayerModal(p.name)); }


    fillRoleSelect(role1, (p.roles && p.roles[0]) ? p.roles[0] : "centrocampista", false);
    fillRoleSelect(role2, (p.roles && p.roles[1]) ? p.roles[1] : "", true);

    numInput.addEventListener("input", ()=>{ numPrev.textContent = numInput.value.trim(); });

    item.querySelector("button[data-save]").addEventListener("click", () => {
      const roles = [role1.value, role2.value].filter(Boolean).slice(0,2);
      p.roles = roles.length ? roles : ["centrocampista"];
      p.number = numInput.value.trim();
      saveState();
      renderBench();
          toast("Salvato ✅");
    });

    item.querySelector("button[data-del]").addEventListener("click", () => removePlayer(p.name));

    el.rosterList.appendChild(item);
  });

  saveState();
}

function addPlayer() {
  const name = (el.newPlayerName.value || "").trim();
  const role = el.newPlayerRole.value || "centrocampista";
  if (!name) return;
  if (state.roster.some(p => p.name === name)) return alert("Nome già presente.");
  state.roster.push({ name, roles: [ROLES.includes(role) ? role : "centrocampista"], number: "" });
  el.newPlayerName.value = "";
  if(newPlayerPhotoData){ state.playerPhotos[name] = newPlayerPhotoData; }
  saveState();
  resetNewPlayerPhoto();
  if(el.newPlayerPhoto) el.newPlayerPhoto.value = "";
  renderRoster();
  renderPresenzeAll();
}

function removePlayer(name) {
  if (state.roster.length <= 1) return alert("Deve rimanere almeno un giocatore.");
  if (!confirm(`Rimuovere ${name} dalla rosa?`)) return;

  state.roster = state.roster.filter(p => p.name !== name);

  // rimuove i mark
  for (const m of Object.keys(state.attendance)) {
    for (const s of state.attendance[m].sessions || []) {
      if (s.marks && (name in s.marks)) delete s.marks[name];
    }
  }

  // pulizia partite
  for (const mt of state.matches) {
    if (mt.captain === name) mt.captain = "";
    if (mt.vice === name) mt.vice = "";
  }

  saveState();
  renderRoster();
  renderPresenzeAll();
  renderMatches();
}

function resetRoster() {
  if (!confirm("Ripristinare i 13 giocatori?")) return;
  state.roster = structuredClone(DEFAULT_ROSTER);
  saveState();
  renderRoster();
  renderPresenzeAll();
  renderMatches();
}

// ----------------- PARTITE -----------------
function renderCaptainViceOptions() {
  const names = rosterNames();
  function fill(sel) {
    const keep = sel.value;
    sel.innerHTML = "";
    const o0 = document.createElement("option");
    o0.value = ""; o0.textContent = "—";
    sel.appendChild(o0);
    for (const n of names) {
      const o = document.createElement("option");
      o.value = n; o.textContent = n;
      sel.appendChild(o);
    }
    if (names.includes(keep)) sel.value = keep;
  }
  fill(el.captainSelect);
  fill(el.viceSelect);
}

function resetMatchForm() {
  el.matchDate.value = todayISO();
  el.opponent.value = "";
  el.captainSelect.value = "";
  el.viceSelect.value = "";
  el.t1.value = ""; el.t2.value = ""; el.t3.value = ""; el.t4.value = "";
  el.matchNotes.value = "";
}

function saveMatch() {
  const date = el.matchDate.value || todayISO();
  const opponent = (el.opponent.value || "").trim();
  const captain = el.captainSelect.value || "";
  const vice = el.viceSelect.value || "";
  const times = [(el.t1.value||"").trim(), (el.t2.value||"").trim(), (el.t3.value||"").trim(), (el.t4.value||"").trim()];
  const notes = (el.matchNotes.value || "").trim();

  if (!opponent && times.every(x => !x) && !notes) return alert("Inserisci almeno avversario, un risultato o note.");

  state.matches.push({
    id: uid(),
    date, opponent, captain, vice,
    times,
    notes
  });
  state.matches.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  saveState();
  renderMatches();
  resetMatchForm();
}

function removeMatch(id) {
  const m = state.matches.find(x => x.id === id);
  if (!m) return;
  if (!confirm(`Eliminare partita del ${m.date} vs ${m.opponent || "—"}?`)) return;
  state.matches = state.matches.filter(x => x.id !== id);
  saveState();
  renderMatches();
}

function renderMatches() {
  el.matchesTbody.innerHTML = "";
  el.noMatches.classList.toggle("hidden", state.matches.length !== 0);

  for (const m of state.matches) {
    const tr = document.createElement("tr");
    const times = (m.times || []).map((x,i)=>`T${i+1}:${x || "—"}`).join(" • ");
    tr.innerHTML = `
      <td>${escapeHtml(m.date)}</td>
      <td>${escapeHtml(m.opponent || "—")}</td>
      <td>${escapeHtml(m.captain || "—")}</td>
      <td>${escapeHtml(m.vice || "—")}</td>
      <td>${escapeHtml(times)}</td>
      <td class="right"><button class="btn small danger" data-del="${m.id}">X</button></td>
    `;
    tr.querySelector("[data-del]").addEventListener("click", () => removeMatch(m.id));
    el.matchesTbody.appendChild(tr);
  }
}

// ----------------- REPORT -----------------
function allMonths() { return Object.keys(state.attendance).sort(); }

function renderReportMonths() {
  const months = allMonths();
  const keep = el.reportMonth.value;

  el.reportMonth.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = ""; optAll.textContent = "Tutti i mesi";
  el.reportMonth.appendChild(optAll);

  for (const m of months) {
    const o = document.createElement("option");
    o.value = m; o.textContent = m;
    el.reportMonth.appendChild(o);
  }

  el.reportMonth.value = months.includes(keep) ? keep : "";
}

function presenzeSummary(monthFilter) {
  const names = rosterNames();
  let sessions = [];
  const months = monthFilter ? [monthFilter] : allMonths();
  for (const m of months) {
    const md = state.attendance[m];
    if (md?.sessions?.length) sessions = sessions.concat(md.sessions.filter(s=>{const mk=s.marks||{};return Object.values(mk).some(v=>v==="P");}).map(s => ({...s, _month:m})));
  }
  const total = sessions.length;

  const rows = names.map(n => {
    let p=0;
    for (const s of sessions) {
      const mark = s.marks?.[n] || "";
      if (mark === "P") p++;
    }
    const a = total ? Math.max(0, total - p) : 0;
    const pct = total ? Math.round((p/total)*100) : 0;
    return { name:n, p, a, total, pct };
  });

  return { total, rows, sessions };
}

function findPlayer(name) { return state.roster.find(p => p.name === name); }

function renderPlayerReport(name) {
  const p = findPlayer(name);
  if (!p) {
    el.playerReport.classList.add("hidden");
    el.playerReport.innerHTML = "";
    return;
  }

  // Presenze totali su tutti i mesi
  const all = presenzeSummary("").sessions;
  const totalSessions = all.length;
  let present = 0, absent = 0;
  for (const s of all) {
    const m = s.marks?.[name] || "";
    if (m === "P") present++;
    else absent++;
  }
  const pct = totalSessions ? Math.round((present/totalSessions)*100) : 0;

  // per mese
  const byMonth = new Map();
  for (const s of all) {
    const m = s._month;
    if (!byMonth.has(m)) byMonth.set(m, { total:0, p:0, a:0 });
    const r = byMonth.get(m);
    r.total++;
    const mark = s.marks?.[name] || "";
    if (mark==="P") r.p++;
    else r.a++;
  }
  const monthRows = Array.from(byMonth.entries()).sort((a,b)=>a[0].localeCompare(b[0]));

  // partite
  const linkedMatches = state.matches.filter(m => m.captain===name || m.vice===name);

  el.playerReport.classList.remove("hidden");
  el.playerReport.innerHTML = `
    <div class="badge">👤 <b>${escapeHtml(name)}</b></div>
    <div class="sp8"></div>

    <div class="grid">
      <div class="card" style="box-shadow:none;">
        <h2>Presenze totali</h2>
        <div class="center">
          <span class="badge ok">Presenze: <b>${present}</b></span>
          <span class="badge warn">Assenze: <b>${absent}</b></span>
          <span class="badge">Tot: <b>${totalSessions}</b></span>
          <div class="sp8"></div>
          <span class="badge ${pct>=75 ? "ok" : ""}">Percentuale: <b>${pct}%</b></span>
        </div>
      </div>

      <div class="card" style="box-shadow:none;">
        <h2>Ruolo</h2>
        <div class="center"><span class="badge">${escapeHtml((Array.isArray(p.roles)?p.roles.filter(Boolean).join(" / "):(p.role||"—")) || "—")}</span></div>
        <div class="sp8"></div>
        <h2>Partite</h2>
        <div class="center">
          <span class="badge">Collegate (cap/vice): <b>${linkedMatches.length}</b></span>
        </div>
      </div>
    </div>

    <div class="sp8"></div>
    <div class="card" style="box-shadow:none;">
      <h2>Presenze per mese</h2>
      <div style="overflow:auto;">
        <table>
          <thead><tr><th>Mese</th><th class="right">P</th><th class="right">A</th><th class="right">Tot</th><th class="right">%</th></tr></thead>
          <tbody>
            ${monthRows.map(([m,r]) => {
              const mp = r.total ? Math.round((r.p/r.total)*100) : 0;
              return `
                <tr>
                  <td>${escapeHtml(m)}</td>
                  <td class="right">${r.p}</td>
                  <td class="right">${r.a}</td>
                  <td class="right">${r.total}</td>
                  <td class="right"><span class="badge ${mp>=75 ? "ok" : ""}">${mp}%</span></td>
                </tr>
              `;
            }).join("") || `<tr><td colspan="5" class="muted center">Nessun mese generato.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="sp8"></div>
    <div class="card" style="box-shadow:none;">
      <h2>Partite collegate</h2>
      <div style="overflow:auto;">
        <table>
          <thead><tr><th>Data</th><th>Avversario</th><th>Ruolo</th><th>Tempi</th></tr></thead>
          <tbody>
            ${linkedMatches.map(m => {
              const role = m.captain===name ? "Capitano" : "Vice";
              const times = (m.times||[]).map((x,i)=>`T${i+1}:${x||"—"}`).join(" • ");
              return `
                <tr>
                  <td>${escapeHtml(m.date)}</td>
                  <td>${escapeHtml(m.opponent||"—")}</td>
                  <td>${escapeHtml(role)}</td>
                  <td>${escapeHtml(times)}</td>
                </tr>
              `;
            }).join("") || `<tr><td colspan="4" class="muted center">Nessuna partita collegata.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderGeneralReport() {
  const mode = el.reportMode.value;
  const monthFilter = el.reportMonth.value;
  el.reportMonthWrap.classList.toggle("hidden", mode !== "presenze");

  if (mode === "presenze") {
    const s = presenzeSummary(monthFilter);
    const title = monthFilter ? `Report Presenze • ${monthFilter}` : "Report Presenze • Tutti i mesi";
    el.reportContent.innerHTML = `
      <div class="badge">📊 ${escapeHtml(title)} • Allenamenti totali: <b>${s.total}</b></div>
      <div class="sp8"></div>
      <div style="overflow:auto;">
        <table>
          <thead><tr><th>Giocatore</th><th class="right">P</th><th class="right">A</th><th class="right">Tot</th><th class="right">%</th></tr></thead>
          <tbody>
            ${s.rows.map(r => `
              <tr>
                <td>${escapeHtml(r.name)}</td>
                <td class="right">${r.p}</td>
                <td class="right">${r.a}</td>
                <td class="right">${r.total}</td>
                <td class="right"><span class="badge ${r.pct>=75 ? "ok" : ""}">${r.pct}%</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ${s.total===0 ? `<p class="muted center" style="margin:10px 0 0;">Genera almeno un mese in “Presenze”.</p>` : ""}
    `;
  } else {
    const count = state.matches.length;
    el.reportContent.innerHTML = `
      <div class="badge">🏟️ Report Partite • Totale: <b>${count}</b></div>
      <div class="sp8"></div>
      <div style="overflow:auto;">
        <table>
          <thead><tr><th>Data</th><th>Avversario</th><th>Cap.</th><th>Vice</th><th>Tempi</th></tr></thead>
          <tbody>
            ${state.matches.map(m => {
              const times = (m.times||[]).map((x,i)=>`T${i+1}:${x||"—"}`).join(" • ");
              return `
                <tr>
                  <td>${escapeHtml(m.date)}</td>
                  <td>${escapeHtml(m.opponent||"—")}</td>
                  <td>${escapeHtml(m.captain||"—")}</td>
                  <td>${escapeHtml(m.vice||"—")}</td>
                  <td>${escapeHtml(times)}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
      ${count===0 ? `<p class="muted center" style="margin:10px 0 0;">Inserisci una partita nella scheda “Partite”.</p>` : ""}
    `;
  }
}

function renderReport() {
  if(!el.reportContent) return;
  renderReportMonths();

  const name = (el.playerSearch.value || "").trim();
  if (name && rosterNames().includes(name)) renderPlayerReport(name);
  else {
    el.playerReport.classList.add("hidden");
    el.playerReport.innerHTML = "";
  }
  renderGeneralReport();
}

// ----------------- TATTICHE (non salvate) -----------------
let t = {
  mode: "draw", // draw | erase | move | text | delete
  selectedPlayer: null,
  tokens: [], // {id,name,x,y}
  draggingId: null,
  drawDown: false,
  ctx: null,
};

let pitchImg = null;
function loadPitchImage() {
  if (pitchImg) return;
  pitchImg = new Image();
  pitchImg.src = "pitch.png";
  pitchImg.onload = () => tacticsRenderAll();
}
function tacticsFieldBackground(ctx, w, h) {
  // sfondo: immagine campo dall'alto (fornita)
  if (pitchImg && pitchImg.complete && pitchImg.naturalWidth) {
    // cover
    const iw = pitchImg.naturalWidth, ih = pitchImg.naturalHeight;
    const scale = Math.max(w/iw, h/ih);
    const sw = iw*scale, sh = ih*scale;
    const sx = (w - sw)/2, sy = (h - sh)/2;
    ctx.drawImage(pitchImg, sx, sy, sw, sh);
    return;
  }
  // fallback verde a strisce se l'immagine non è ancora pronta
  for (let x=0; x<w; x+=90) {
    ctx.fillStyle = (Math.floor(x/90)%2===0) ? "#0b5f2a" : "#0a5525";
    ctx.fillRect(x,0,90,h);
  }
}

function tacticsDrawTokens(ctx) {
  for (const tk of t.tokens) {
    const r = 20;
    const drew = drawTokenWithPhoto(ctx, tk, r);
    if(!drew){
      // fallback: cerchio giallorosso
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.beginPath(); ctx.arc(tk.x, tk.y, r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(tk.x, tk.y, r, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const parts = (tk.name||"").split(" ");
      const initials = (parts[0]?.[0]||"") + (parts[1]?.[0]||"");
      ctx.fillText(initials.toUpperCase(), tk.x, tk.y);
      ctx.restore();
    }

    // numero (se presente)
    const num = numberForPlayer(tk.name);
    if(num){
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,.65)";
      ctx.beginPath(); ctx.arc(tk.x+14, tk.y-14, 11, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(tk.x+14, tk.y-14, 11, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.font = "800 11px system-ui";
      ctx.textAlign = "center"; ctx.textBaseline="middle";
      ctx.fillText(String(num).slice(0,3), tk.x+14, tk.y-14);
      ctx.restore();
    }

    // nome sotto
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.font = "600 11px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(tk.name, tk.x, tk.y + r + 6);
    ctx.restore();
  }
}


function drawTokenWithPhoto(ctx, tk, r){
  const src = photoForPlayer(tk.name);
  if(src){
    const img = new Image();
    img.src = src;
    // cache images in memory
    t.photoCache = t.photoCache || {};
    if(t.photoCache[src] && t.photoCache[src].complete){
      const im = t.photoCache[src];
      ctx.save();
      ctx.beginPath(); ctx.arc(tk.x, tk.y, r, 0, Math.PI*2); ctx.clip();
      // cover crop
      const iw = im.naturalWidth||1, ih = im.naturalHeight||1;
      const scale = Math.max((r*2)/iw, (r*2)/ih);
      const dw = iw*scale, dh = ih*scale;
      ctx.drawImage(im, tk.x-r - (dw-(r*2))/2, tk.y-r - (dh-(r*2))/2, dw, dh);
      ctx.restore();
      // ring
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(tk.x, tk.y, r, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
      return true;
    } else {
      t.photoCache[src] = img;
      img.onload = () => tacticsRenderAll();
    }
  }
  return false;
}

function tacticsHitToken(x,y) {
  for (let i=t.tokens.length-1; i>=0; i--) {
    const tk = t.tokens[i];
    const dx = x - tk.x, dy = y - tk.y;
    if (Math.sqrt(dx*dx + dy*dy) <= 18) return tk.id;
  }
  return null;
}

function tacticsRenderAll() {
  if (!el.tacticsCanvas) return;
  const ctx = el.tacticsCanvas.getContext("2d");
  t.ctx = ctx;
  const w = el.tacticsCanvas.width;
  const h = el.tacticsCanvas.height;

  // sfondo campo
  tacticsFieldBackground(ctx, w, h);

  // disegno libero: lo gestiamo su un layer in-memory? (semplice: disegno direttamente sul canvas)
  // Per mantenere i disegni mentre ridisegniamo, usiamo un offscreen bitmap:
  if (!t.ink) {
    t.ink = document.createElement("canvas");
    t.ink.width = w; t.ink.height = h;
    t.inkCtx = t.ink.getContext("2d");
  }
  ctx.drawImage(t.ink, 0, 0);

  // tokens
  tacticsDrawTokens(ctx);
}

function setTacticsMode(mode) {
  t.mode = mode;
  el.toolDraw.classList.toggle("active", mode==="draw");
  el.toolErase.classList.toggle("active", mode==="erase");
  el.toolMove.classList.toggle("active", mode==="move");
  if (el.toolText) el.toolText.classList.toggle("active", mode==="text");
  if (el.toolDelete) el.toolDelete.classList.toggle("active", mode==="delete");
}

function canvasPoint(e) {
  const rect = el.tacticsCanvas.getBoundingClientRect();
  const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
  const clientY = (e.touches ? e.touches[0].clientY : e.clientY);
  const x = (clientX - rect.left) * (el.tacticsCanvas.width / rect.width);
  const y = (clientY - rect.top) * (el.tacticsCanvas.height / rect.height);
  return {x,y};
}

function onCanvasDown(e) {
  e.preventDefault();
  const {x,y} = canvasPoint(e);

  // DELETE: tocca un token per rimuoverlo
  if (t.mode === "delete") {
    const hit = tacticsHitToken(x,y);
    if (hit) {
      t.tokens = t.tokens.filter(z => z.id !== hit);
      tacticsRenderAll();
    }
    return;
  }

  // TEXT: tap per inserire testo (prompt)
  if (t.mode === "text") {
    const txt = prompt("Scrivi con il pennarello (testo):", "");
    if (txt && txt.trim()) {
      t.inkCtx.save();
      t.inkCtx.globalCompositeOperation = "source-over";
      t.inkCtx.fillStyle = "rgba(255,255,255,.9)";
      t.inkCtx.font = "bold 18px system-ui";
      // sfondo leggibile
      const label = txt.trim().slice(0,60);
      const m = t.inkCtx.measureText(label);
      t.inkCtx.fillStyle = "rgba(0,0,0,.55)";
      t.inkCtx.fillRect(x-6, y-22, m.width+12, 26);
      t.inkCtx.fillStyle = "rgba(255,255,255,.92)";
      t.inkCtx.fillText(label, x, y-4);
      t.inkCtx.restore();
      tacticsRenderAll();
    }
    return;
  }

  if (t.mode === "move") {
    const hit = tacticsHitToken(x,y);
    if (hit) {
      t.draggingId = hit;
      t.dragStart = {x,y};
      t.dragMoved = false;
      return;
    }
    // se non ho colpito un token ma ho selezionato un player -> piazza token
    if (t.selectedPlayer) {
      t.tokens.push({ id: uid(), name: t.selectedPlayer, x, y });
      t.selectedPlayer = null;
      el.selectedToken.textContent = "Selezionato: —";
      tacticsRenderAll();
    }
    return;
  }

  // draw/erase -> disegno su ink layer
  t.drawDown = true;
  t.inkCtx.lineCap = "round";
  t.inkCtx.lineJoin = "round";
  if (t.mode === "draw") {
    t.inkCtx.globalCompositeOperation = "source-over";
    t.inkCtx.strokeStyle = "rgba(255,255,255,.9)";
    t.inkCtx.lineWidth = 5;
  } else {
    t.inkCtx.globalCompositeOperation = "destination-out";
    t.inkCtx.lineWidth = 18;
  }
  t.inkCtx.beginPath();
  t.inkCtx.moveTo(x,y);
}

function onCanvasMove(e) {
  if (t.mode === "move" && t.draggingId) {
    e.preventDefault();
    const {x,y} = canvasPoint(e);
    const tk = t.tokens.find(z => z.id === t.draggingId);
    if (tk) { tk.x = x; tk.y = y; }
    // segnala movimento per distinguere dal "tap"
    const dx = x - (t.dragStart?.x ?? x);
    const dy = y - (t.dragStart?.y ?? y);
    if (Math.sqrt(dx*dx+dy*dy) > 6) t.dragMoved = true;
    tacticsRenderAll();
    return;
  }

  if (!t.drawDown) return;
  e.preventDefault();
  const {x,y} = canvasPoint(e);
  t.inkCtx.lineTo(x,y);
  t.inkCtx.stroke();
  tacticsRenderAll();
}

function onCanvasUp(e) {
  if (t.mode === "move") {
    // se ho "toccato" un token senza spostarlo -> chiedo se eliminarlo
    if (t.draggingId && !t.dragMoved) {
      const id = t.draggingId;
      const tk = t.tokens.find(z => z.id === id);
      if (tk) {
        const ok = confirm(`Eliminare ${tk.name} dal campo?`);
        if (ok) t.tokens = t.tokens.filter(z => z.id !== id);
      }
    }
    t.draggingId = null;
    t.dragMoved = false;
    t.dragStart = null;
    tacticsRenderAll();
    return;
  }
  t.drawDown = false;
}

function renderBench() {
  if (!el.bench) return;
  el.bench.innerHTML = "";
  for (const p of state.roster) {
    const b = document.createElement("button");
    b.className = "btn small";
    b.textContent = p.name;
    b.addEventListener("click", () => {
      setTacticsMode("move"); // piazzamento/spostamento
      t.selectedPlayer = p.name;
      el.selectedToken.textContent = `Selezionato: ${p.name} (tocca il campo)`;
    });
    el.bench.appendChild(b);
  }
}

// ----------------- EVENTS -----------------
setMonthInputDefaults();
ensureAttendanceShape();
updateSaveAttendanceUI();
renderPresenzeAll();

// Presenze (selettori anno/mese)
function onPresenzeMonthChanged(){
  attendanceDirty = false;
  updateSaveAttendanceUI();
  renderPresenzeAll();
}
if(el.yearPick){
  el.yearPick.addEventListener("change", ()=>{
    populateMonthSelect(el.monthPick, el.yearPick.value);
    onPresenzeMonthChanged();
  });
}
if(el.monthPick){
  el.monthPick.addEventListener("change", onPresenzeMonthChanged);
}

if(el.sessionPick){
  el.sessionPick.addEventListener("change", ()=>{
    renderSessionChecklist();
    renderPercentages();
  });
}
if(el.printMonthBtn){
  el.printMonthBtn.addEventListener("click", printPresenzeMonthPdf);
}
if(el.saveAttendanceBtn){
  el.saveAttendanceBtn.addEventListener("click", saveAttendanceMonth);
}

// Report mensile (selettori anno/mese)
function onReportMonthChanged(){
  renderMonthlyReport();
}
if(el.monthlyYearPick){
  el.monthlyYearPick.addEventListener("change", ()=>{
    populateMonthSelect(el.monthlyReportMonth, el.monthlyYearPick.value);
    onReportMonthChanged();
  });
}
if(el.monthlyReportMonth){
  el.monthlyReportMonth.addEventListener("change", onReportMonthChanged);
}
if(el.printMonthlyPdfBtn){
  el.printMonthlyPdfBtn.addEventListener("click", printMonthlyPdf);
}
// Rosa
fillRoleSelect(el.newPlayerRole, "centrocampista", false);
el.addPlayerBtn.addEventListener("click", addPlayer);
el.newPlayerName.addEventListener("keydown", (e)=>{ if (e.key==="Enter") addPlayer(); });
el.resetRosterBtn.addEventListener("click", resetRoster);

el.saveMatchBtn.addEventListener("click", saveMatch);
el.resetMatchBtn.addEventListener("click", resetMatchForm);


// Tattiche buttons
el.toolDraw.addEventListener("click", ()=>{t.selectedPlayer=null; el.selectedToken.textContent="Selezionato: —"; setTacticsMode("draw");});
el.toolErase.addEventListener("click", ()=>{t.selectedPlayer=null; el.selectedToken.textContent="Selezionato: —"; setTacticsMode("erase");});
el.toolMove.addEventListener("click", ()=>setTacticsMode("move"));
el.toolText.addEventListener("click", ()=>{t.selectedPlayer=null; el.selectedToken.textContent="Selezionato: —"; setTacticsMode("text");});
el.toolDelete.addEventListener("click", ()=>{t.selectedPlayer=null; el.selectedToken.textContent="Selezionato: —"; setTacticsMode("delete");});
el.toolClear.addEventListener("click", ()=>{
  // reset canvas ink + tokens (no save)
  if (t.inkCtx) {
    t.inkCtx.clearRect(0,0,el.tacticsCanvas.width, el.tacticsCanvas.height);
  }
  t.tokens = [];
  t.selectedPlayer = null;
  el.selectedToken.textContent = "Selezionato: —";
  tacticsRenderAll();
});
el.toolFullscreen && el.toolFullscreen.addEventListener("click", async () => {
  const target = document.getElementById("tacticsBoard") || document.getElementById("page-tattiche") || document.documentElement;
  try{
    if(!document.fullscreenElement){
      await target.requestFullscreen();
      el.toolFullscreen.textContent = "Esci schermo intero";
    } else {
      await document.exitFullscreen();
      el.toolFullscreen.textContent = "Schermo intero";
    }
  }catch(e){
    console.warn(e);
    toast("Schermo intero non disponibile");
  }
});

document.addEventListener("fullscreenchange", ()=>{
  if(!document.fullscreenElement && el.toolFullscreen){
    el.toolFullscreen.textContent = "Schermo intero";
  }
});
// Apri schermo intero anche con doppio tap/click o pressione lunga sul campo (mobile).
(function bindTacticsQuickFullscreen(){
  if(!el.tacticsCanvas) return;
  // doppio click (desktop)
  el.tacticsCanvas.addEventListener("dblclick", (e)=>{
    e.preventDefault();
    el.toolFullscreen?.click();
  });

  // pressione lunga (mobile)
  let pressTimer = null;
  let moved = false;

  const startPress = (ev)=>{
    moved = false;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(()=>{
      // solo se non stai disegnando/spostando: evita sorprese
      if(!moved) el.toolFullscreen?.click();
    }, 380);
  };
  const cancelPress = ()=>{
    clearTimeout(pressTimer);
    pressTimer = null;
  };

  el.tacticsCanvas.addEventListener("touchstart", (e)=>{ startPress(e); }, {passive:true});
  el.tacticsCanvas.addEventListener("touchmove", ()=>{ moved = true; cancelPress(); }, {passive:true});
  el.tacticsCanvas.addEventListener("touchend", cancelPress);
  el.tacticsCanvas.addEventListener("touchcancel", cancelPress);
})();



// canvas listeners (pointer+touch)
el.tacticsCanvas.addEventListener("mousedown", onCanvasDown);
el.tacticsCanvas.addEventListener("mousemove", onCanvasMove);
window.addEventListener("mouseup", onCanvasUp);

el.tacticsCanvas.addEventListener("touchstart", onCanvasDown, {passive:false});
el.tacticsCanvas.addEventListener("touchmove", onCanvasMove, {passive:false});
el.tacticsCanvas.addEventListener("touchend", onCanvasUp);

// ----------------- INIT -----------------
const tday = todayISO();
if(el.monthPick) el.monthPick.value = tday.slice(0,7);
if(el.monthlyReportMonth) el.monthlyReportMonth.value = tday.slice(0,7);
if(el.matchDate) el.matchDate.value = tday;

renderRoster();
renderMatches();
renderPresenzeAll();
resetMatchForm();


// tattiche init
loadPitchImage();
setTacticsMode("draw");
tacticsRenderAll();

// salva anche migrazione eventuale
saveState();


// --- Modal giocatore (Rosa) ---
function openPlayerModal(playerName){
  const p = state.roster.find(x=>x.name===playerName);
  if(!p) return;
  const roles = Array.isArray(p.roles) ? p.roles : [];
  const roleTxt = roles.filter(Boolean).join(" / ") || "—";
  const src = photoForPlayer(p.name);
  el.playerModalTitle.textContent = "Scheda giocatore";
  el.playerModalBody.innerHTML = `
    <div class="profile">
      <img src="${src}" alt="" onerror="this.src='${PLACEHOLDER_PHOTO}'">
      <div class="meta">
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="line"><b>Ruoli:</b> ${escapeHtml(roleTxt)}</div>
        <div class="line" style="margin-top:6px;"><b>Numero:</b> ${escapeHtml(String(p.number||"—"))}</div>
      </div>
    </div>
  `;
  el.playerModal.classList.add("show");
  el.playerModal.setAttribute("aria-hidden","false");
}
function closePlayerModal(){
  el.playerModal.classList.remove("show");
  el.playerModal.setAttribute("aria-hidden","true");
}


// Modal events
el.playerModalClose?.addEventListener("click", closePlayerModal);
el.playerModal?.addEventListener("click", (e)=>{ if(e.target === el.playerModal) closePlayerModal(); });
document.addEventListener("keydown", (e)=>{ if(e.key === "Escape") closePlayerModal(); });


let newPlayerPhotoData = null;
function resetNewPlayerPhoto(){
  newPlayerPhotoData = null;
  if(el.newPlayerAvatar) el.newPlayerAvatar.src = PLACEHOLDER_PHOTO;
}
el.newPlayerAvatar?.addEventListener("click", ()=> el.newPlayerPhoto?.click());
el.newPlayerPhoto?.addEventListener("change", async ()=>{
  const f = el.newPlayerPhoto.files && el.newPlayerPhoto.files[0];
  if(!f) return;
  // resize to 512 square to keep light
  const dataUrl = await fileToSquareDataURL(f, 512);
  newPlayerPhotoData = dataUrl;
  el.newPlayerAvatar.src = dataUrl;
});
el.clearNewPlayerPhotoBtn?.addEventListener("click", ()=>{ if(el.newPlayerPhoto) el.newPlayerPhoto.value=""; resetNewPlayerPhoto(); });

async function fileToSquareDataURL(file, size){
  const img = await new Promise((res, rej)=>{
    const i = new Image();
    i.onload = ()=>res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const side = Math.min(iw, ih);
  const sx = (iw - side)/2;
  const sy = (ih - side)/2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.85);
}

// Re-bind modal close after refresh
setTimeout(()=>{
  if(!el.playerModalClose) refreshDynamicEls();
  el.playerModalClose?.addEventListener('click', closePlayerModal);
}, 0);


// --- Mister profile ---
const logoInput=document.getElementById('logoInput');
const teamLogo=document.getElementById('teamLogo');
const misterName=document.getElementById('misterName');
const categoria=document.getElementById('categoria');

function loadProfile(){
  const l=localStorage.getItem('teamLogo'); if(l) teamLogo.src=l;
  misterName.value=localStorage.getItem('misterName')||'';
  categoria.value=localStorage.getItem('categoria')||'';
}
logoInput?.addEventListener('change',e=>{
  const file=e.target.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=()=>{ teamLogo.src=r.result; localStorage.setItem('teamLogo',r.result); };
  r.readAsDataURL(file);
});
teamLogo?.addEventListener('click',()=>logoInput.click());
misterName?.addEventListener('input',()=>localStorage.setItem('misterName',misterName.value));
categoria?.addEventListener('change',()=>localStorage.setItem('categoria',categoria.value));
document.addEventListener('DOMContentLoaded',loadProfile);