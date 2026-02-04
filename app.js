
/* Fabrizio Coach - v30 (stable) */
const APP_VERSION = "2.2";
const STORE_KEY = "mister_coach_v30"; // new key => presenze azzerate

const TRAIN_DAYS = [1,3,4]; // Lun=1, Mer=3, Gio=4 (JS: 0=Dom)
const PLACEHOLDER_PHOTO = "placeholder.png";

const DEFAULT_ROSTER = [
  "BATTAGLIA RICCARDO",
  "BENMIMOUN AMIR",
  "BENMIMOUN HEDI",
  "BURIOLA ELIA",
  "CASONATO CHRISTIAN",
  "DE GIUSTI GIACOMO",
  "GHIRARDO GABRIEL",
  "GHIRARDO GIANMARIA",
  "GUZ PATRICK",
  "HALLULLI LEON",
  "MARKU OREST",
  "SONEGO LEONARDO",
  "ZULIANI EVAN"
];

const PHOTO_MAP = {
  "BATTAGLIA RICCARDO": "photos/riccardo.jpg",
  "BENMIMOUN AMIR": "photos/amir.jpg",
  "BENMIMOUN HEDI": "photos/hedi.jpg",
  "BURIOLA ELIA": "photos/elia.jpg",
  "CASONATO CHRISTIAN": "photos/christian.jpg",
  "DE GIUSTI GIACOMO": "photos/giacomo.jpg",
  "GHIRARDO GABRIEL": "photos/gabriel.jpg",
  "GHIRARDO GIANMARIA": "photos/gianmaria.jpg",
  "GUZ PATRICK": "photos/patrick.jpg",
  "HALLULLI LEON": "photos/leon.jpg",
  "MARKU OREST": "photos/orest.jpg",
  "SONEGO LEONARDO": "photos/leonardo.jpg",
  "ZULIANI EVAN": "photos/evan.jpg"
};

function safeJSONParse(str, fallback){
  try{ return JSON.parse(str); }catch{ return fallback; }
}

function loadState(){
  const raw = localStorage.getItem(STORE_KEY);
  const s = safeJSONParse(raw, null);
  if(s && s.version){ return s; }
  return {
    version: APP_VERSION,
    coachName: "COACH",
    roster: DEFAULT_ROSTER.map(n => ({ id: crypto.randomUUID(), name: n, photo: PHOTO_MAP[n] || null })),
    // attendance: { "YYYY-MM-DD": { "<playerId>": true/false } }
    attendance: {},
    tactics: {
      tokens: [] // {playerId, x, y}
    }
  };
}

function saveState(){
  state.version = APP_VERSION;
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

let state = loadState();

/* DOM */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const tabBtns = $$(".tabbtn");
const tabs = {
  presenze: $("#tab-presenze"),
  rosa: $("#tab-rosa"),
  partite: $("#tab-partite"),
  tattiche: $("#tab-tattiche")
};

const pillTeam = $("#pillTeam");
const pillMonth = $("#pillMonth");

const selYear = $("#selYear");
const selMonth = $("#selMonth");
const selSession = $("#selSession");
const attendanceList = $("#attendanceList");
const stickySave = $("#stickySave");
const btnSave = $("#btnSave");
const saveHint = $("#saveHint");
const btnPrintMonth = $("#btnPrintMonth");

const rosterList = $("#rosterList");
const btnAddPlayer = $("#btnAddPlayer");

const dlgPlayer = $("#dlgPlayer");
const dlgTitle = $("#dlgTitle");
const dlgBody = $("#dlgBody");
const dlgClose = $("#dlgClose");
const btnRemovePlayer = $("#btnRemovePlayer");
const btnChangePhoto = $("#btnChangePhoto");
const filePhoto = $("#filePhoto");

const pitchWrap = $("#pitchWrap");
const pitchTokens = $("#pitchTokens");
const bench = $("#bench");
const btnClearPitch = $("#btnClearPitch");
const btnFullPitch = $("#btnFullPitch");

let currentTab = "presenze";
let currentPlayerId = null;
let dirtyAttendance = false;
let lastBuiltMonthKey = null;

function setTab(name){
  currentTab = name;
  tabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  Object.entries(tabs).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
  if(name === "rosa") renderRoster();
  if(name === "tattiche") renderTactics();
  if(name === "presenze") renderAttendance();
}

tabBtns.forEach(btn => btn.addEventListener("click", () => setTab(btn.dataset.tab)));

/* Utils dates */
function pad2(n){ return String(n).padStart(2,"0"); }
function ymd(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function monthKey(y,m){ return `${y}-${pad2(m)}`; } // m 1..12
function daysInMonth(y,m){ return new Date(y, m, 0).getDate(); } // m 1..12
function weekdayIt(d){
  const map = ["Dom","Lun","Mar","Mer","Gio","Ven","Sab"];
  return map[d.getDay()];
}
function monthNameIt(m){ // 1..12
  return ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"][m-1];
}

function buildYearMonthSelectors(){
  const now = new Date();
  const y0 = now.getFullYear() - 2;
  const y1 = now.getFullYear() + 1;
  selYear.innerHTML = "";
  for(let y=y0;y<=y1;y++){
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    if(y===now.getFullYear()) opt.selected = true;
    selYear.appendChild(opt);
  }
  selMonth.innerHTML = "";
  for(let m=1;m<=12;m++){
    const opt = document.createElement("option");
    opt.value = String(m);
    opt.textContent = monthNameIt(m);
    if(m===now.getMonth()+1) opt.selected = true;
    selMonth.appendChild(opt);
  }
}

function buildSessionsForMonth(y,m){
  const sessions = [];
  const dim = daysInMonth(y,m);
  for(let day=1; day<=dim; day++){
    const d = new Date(y, m-1, day);
    if(TRAIN_DAYS.includes(d.getDay())){
      sessions.push({ date: ymd(d), label: `${weekdayIt(d)} ${pad2(day)}/${pad2(m)}/${y}` });
    }
  }
  return sessions;
}

function ensureSessionSelect(){
  const y = parseInt(selYear.value,10);
  const m = parseInt(selMonth.value,10);
  const sessions = buildSessionsForMonth(y,m);

  selSession.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "Seleziona giornata";
  selSession.appendChild(ph);

  sessions.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.date;
    opt.textContent = s.label;
    selSession.appendChild(opt);
  });
}

function attendanceForDate(dateStr){
  if(!state.attendance[dateStr]) state.attendance[dateStr] = {};
  return state.attendance[dateStr];
}

function renderHeaderPills(){
  pillTeam.textContent = `Rosa: ${state.roster.length}`;
  // presenze mese corrente selezionato
  const y = parseInt(selYear.value,10);
  const m = parseInt(selMonth.value,10);
  const mk = monthKey(y,m);
  const monthDates = Object.keys(state.attendance).filter(d => d.startsWith(mk+"-"));
  let total = 0;
  monthDates.forEach(d=>{
    const a = state.attendance[d] || {};
    total += Object.values(a).filter(Boolean).length;
  });
  pillMonth.textContent = `Presenze mese: ${total}`;
}

function setDirty(flag){
  dirtyAttendance = flag;
  stickySave.classList.toggle("hidden", !flag);
  saveHint.textContent = flag ? "Modifiche non salvate" : "Salvato";
}

function renderAttendance(){
  ensureSessionSelect();
  renderHeaderPills();

  const dateStr = selSession.value;
  attendanceList.innerHTML = "";
  setDirty(false);

  if(!dateStr){
    return;
  }
  const att = attendanceForDate(dateStr);
  state.roster.forEach(p=>{
    const row = document.createElement("div");
    row.className = "playerRow";
    const left = document.createElement("div");
    left.className = "left";

    const img = document.createElement("img");
    img.className = "avatar";
    img.alt = p.name;
    img.src = resolvePhoto(p);

    const nm = document.createElement("div");
    nm.style.minWidth = "0";
    nm.innerHTML = `<div class="name">${escapeHtml(p.name)}</div><div class="meta">${dateStr}</div>`;

    left.appendChild(img);
    left.appendChild(nm);

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.className = "chk";
    chk.checked = !!att[p.id];
    chk.addEventListener("change", ()=>{
      att[p.id] = chk.checked;
      setDirty(true);
      renderHeaderPills();
    });

    row.appendChild(left);
    row.appendChild(chk);
    attendanceList.appendChild(row);
  });
}

selYear.addEventListener("change", ()=>{
  selSession.value = "";
  renderAttendance();
});
selMonth.addEventListener("change", ()=>{
  selSession.value = "";
  renderAttendance();
});
selSession.addEventListener("change", renderAttendance);

btnSave.addEventListener("click", ()=>{
  if(!selSession.value){ return; }
  saveState();
  setDirty(false);
  renderHeaderPills();
});

btnPrintMonth.addEventListener("click", ()=>{
  const y = parseInt(selYear.value,10);
  const m = parseInt(selMonth.value,10);
  printMonthPDF(y,m);
});

function computeMonthReport(y,m){
  const mk = monthKey(y,m);
  const sessions = buildSessionsForMonth(y,m).map(s=>s.date);
  const perPlayer = state.roster.map(p=>{
    let pres = 0;
    sessions.forEach(d=>{
      const a = state.attendance[d];
      if(a && a[p.id]) pres++;
    });
    const tot = sessions.length;
    const abs = tot - pres;
    const pct = tot ? Math.round((pres/tot)*100) : 0;
    return { player: p, pres, abs, tot, pct };
  });
  return { sessions, perPlayer };
}

function printMonthPDF(y,m){
  // Build printable HTML in a new window (reliable on desktop); fallback to same window for iOS.
  const { sessions, perPlayer } = computeMonthReport(y,m);

  const title = `Presenze ${monthNameIt(m)} ${y}`;
  const rows = perPlayer.map(r=>{
    return `<tr>
      <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(r.player.name)}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;">${r.pres}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;">${r.abs}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;">${r.tot}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;">${r.pct}%</td>
    </tr>`;
  }).join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding:18px; }
  h1{ font-size:18px; margin:0 0 8px; }
  .meta{ color:#333; font-size:12px; margin-bottom:14px; }
  table{ border-collapse:collapse; width:100%; }
  th{ background:#f2f2f2; }
  th,td{ font-size:12px; }
  @media print{ body{ padding:0; } }
</style></head>
<body>
<h1>${title}</h1>
<div class="meta">Allenamenti: ${sessions.length} (Lun / Mer / Gio)</div>
<table>
  <thead>
    <tr>
      <th style="padding:8px;border:1px solid #ddd;text-align:left;">Giocatore</th>
      <th style="padding:8px;border:1px solid #ddd;">Presenze</th>
      <th style="padding:8px;border:1px solid #ddd;">Assenze</th>
      <th style="padding:8px;border:1px solid #ddd;">Totale</th>
      <th style="padding:8px;border:1px solid #ddd;">%</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<script>
  setTimeout(()=>{ window.focus(); window.print(); }, 250);
</script>
</body></html>`;

  const w = window.open("", "_blank");
  if(w){
    w.document.open();
    w.document.write(html);
    w.document.close();
    return;
  }
  // Fallback (popup blocked): replace current document temporarily in hidden iframe
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(()=>{ iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 300);
  setTimeout(()=>{ iframe.remove(); }, 2000);
}

/* Roster */
function resolvePhoto(p){
  if(p.photo && typeof p.photo === "string"){
    return p.photo;
  }
  return PLACEHOLDER_PHOTO;
}

function renderRoster(){
  rosterList.innerHTML = "";
  renderHeaderPills();

  state.roster.forEach(p=>{
    const row = document.createElement("div");
    row.className = "playerRow";
    const left = document.createElement("div");
    left.className = "left";
    const img = document.createElement("img");
    img.className = "avatar";
    img.alt = p.name;
    img.src = resolvePhoto(p);
    img.addEventListener("click", ()=> openPlayerModal(p.id));
    img.addEventListener("touchend", (e)=>{ e.preventDefault(); openPlayerModal(p.id); }, {passive:false});

    const nm = document.createElement("div");
    nm.style.minWidth = "0";
    nm.innerHTML = `<div class="name">${escapeHtml(p.name)}</div><div class="meta">Tocca la foto per dettagli</div>`;
    left.appendChild(img); left.appendChild(nm);

    const btn = document.createElement("button");
    btn.className = "btn secondary";
    btn.textContent = "Dettagli";
    btn.addEventListener("click", ()=> openPlayerModal(p.id));

    row.appendChild(left);
    row.appendChild(btn);
    rosterList.appendChild(row);
  });

  buildBench();
}

btnAddPlayer.addEventListener("click", ()=>{
  const name = prompt("Nome e Cognome (es. ROSSI MARCO):");
  if(!name) return;
  const clean = name.trim().toUpperCase();
  if(!clean) return;
  state.roster.push({ id: crypto.randomUUID(), name: clean, photo: null });
  saveState();
  renderRoster();
  renderAttendance();
});

function openPlayerModal(playerId){
  const p = state.roster.find(x=>x.id===playerId);
  if(!p) return;
  currentPlayerId = playerId;
  dlgTitle.textContent = p.name;
  dlgBody.innerHTML = `
    <div style="display:flex; gap:12px; align-items:center;">
      <img src="${resolvePhoto(p)}" alt="${escapeHtml(p.name)}" style="width:96px;height:96px;border-radius:999px;object-fit:cover;border:2px solid rgba(141,255,179,.35);">
      <div>
        <div style="font-size:12px;opacity:.85;">ID</div>
        <div style="font-size:12px;word-break:break-all;opacity:.85;">${p.id}</div>
      </div>
    </div>
  `;
  try{ dlgPlayer.showModal(); }catch{ dlgPlayer.setAttribute("open",""); }
}

dlgClose.addEventListener("click", ()=> dlgPlayer.close());
dlgPlayer.addEventListener("click", (e)=>{
  const r = dlgPlayer.getBoundingClientRect();
  const inDialog = (r.top <= e.clientY && e.clientY <= r.bottom && r.left <= e.clientX && e.clientX <= r.right);
  if(!inDialog) dlgPlayer.close();
});

btnRemovePlayer.addEventListener("click", ()=>{
  if(!currentPlayerId) return;
  const p = state.roster.find(x=>x.id===currentPlayerId);
  if(!p) return;
  if(!confirm(`Rimuovere ${p.name}?`)) return;
  // remove from roster
  state.roster = state.roster.filter(x=>x.id!==currentPlayerId);
  // remove attendance entries
  Object.keys(state.attendance).forEach(d=>{
    if(state.attendance[d]) delete state.attendance[d][currentPlayerId];
  });
  // remove tactics tokens
  state.tactics.tokens = state.tactics.tokens.filter(t=>t.playerId!==currentPlayerId);
  saveState();
  dlgPlayer.close();
  renderRoster();
  renderAttendance();
  renderTactics();
});

btnChangePhoto.addEventListener("click", ()=>{
  if(!currentPlayerId) return;
  filePhoto.value = "";
  filePhoto.click();
});
filePhoto.addEventListener("change", async ()=>{
  const file = filePhoto.files && filePhoto.files[0];
  if(!file || !currentPlayerId) return;
  const dataUrl = await fileToDataURL(file);
  const p = state.roster.find(x=>x.id===currentPlayerId);
  if(!p) return;
  p.photo = dataUrl; // store base64 in localStorage
  saveState();
  renderRoster();
  openPlayerModal(currentPlayerId);
});

function fileToDataURL(file){
  return new Promise((resolve,reject)=>{
    const fr = new FileReader();
    fr.onload = ()=> resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

/* Tactics */
function buildBench(){
  bench.innerHTML = "";
  state.roster.forEach(p=>{
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = initials(p.name);
    chip.title = p.name;
    chip.addEventListener("click", ()=> addTokenForPlayer(p.id));
    bench.appendChild(chip);
  });
}

function initials(name){
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] || "";
  const b = parts[1]?.[0] || "";
  return (a+b).toUpperCase();
}

function addTokenForPlayer(playerId){
  // if already on pitch, do nothing
  if(state.tactics.tokens.some(t=>t.playerId===playerId)) return;
  state.tactics.tokens.push({ playerId, x: 0.5, y: 0.6 });
  saveState();
  renderTactics();
}

function renderTactics(){
  buildBench();
  pitchTokens.innerHTML = "";
  const wrapRect = pitchWrap.getBoundingClientRect();
  state.tactics.tokens.forEach((t, idx)=>{
    const p = state.roster.find(x=>x.id===t.playerId);
    if(!p) return;
    const el = document.createElement("div");
    el.className = "token";
    el.textContent = initials(p.name);
    positionToken(el, t);
    enableDrag(el, t);
    el.addEventListener("dblclick", ()=>{ removeToken(t.playerId); });
    el.addEventListener("contextmenu", (e)=>{ e.preventDefault(); removeToken(t.playerId); });
    pitchTokens.appendChild(el);
  });
}

function positionToken(el, t){
  // x,y are normalized 0..1
  const w = pitchWrap.clientWidth;
  const h = pitchWrap.clientHeight;
  const x = t.x * w;
  const y = t.y * h;
  el.style.left = `${Math.max(0, Math.min(w-54, x-27))}px`;
  el.style.top  = `${Math.max(0, Math.min(h-54, y-27))}px`;
}

function enableDrag(el, token){
  let dragging=false;
  let startX=0, startY=0;
  let origX=0, origY=0;

  const onDown = (e)=>{
    dragging=true;
    el.setPointerCapture(e.pointerId);
    startX = e.clientX; startY = e.clientY;
    origX = token.x; origY = token.y;
  };
  const onMove = (e)=>{
    if(!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const w = pitchWrap.clientWidth;
    const h = pitchWrap.clientHeight;
    token.x = clamp(origX + dx / w, 0, 1);
    token.y = clamp(origY + dy / h, 0, 1);
    positionToken(el, token);
  };
  const onUp = ()=>{
    if(!dragging) return;
    dragging=false;
    saveState();
  };

  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
}

function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }

function removeToken(playerId){
  state.tactics.tokens = state.tactics.tokens.filter(t=>t.playerId!==playerId);
  saveState();
  renderTactics();
}

btnClearPitch.addEventListener("click", ()=>{
  if(!confirm("Vuoi pulire il campo?")) return;
  state.tactics.tokens = [];
  saveState();
  renderTactics();
});

// fullscreen: use dialog-like full screen overlay using Fullscreen API if available.
function requestFull(el){
  if(el.requestFullscreen) return el.requestFullscreen();
  if(el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
}
btnFullPitch.addEventListener("click", ()=> requestFull(pitchWrap));

// Double tap on pitch to fullscreen (mobile)
let lastTapTs = 0;
pitchWrap.addEventListener("touchend", (e)=>{
  const now = Date.now();
  if(now - lastTapTs < 320){
    requestFull(pitchWrap);
  }
  lastTapTs = now;
}, {passive:true});

/* Escape */
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[s]));
}

/* Init */
buildYearMonthSelectors();
ensureSessionSelect();
renderRoster();
renderAttendance();
renderTactics();
renderHeaderPills();

// Keep tokens positioned on resize
window.addEventListener("resize", ()=> {
  if(currentTab==="tattiche") renderTactics();
});
