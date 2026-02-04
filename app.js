/* Fabrizio Coach v29 (2.1) */

const APP_VERSION = "2.1";
const STORAGE_PREFIX = "fcoach_v29_"; // changing prefix resets old data automatically

// --- ROSTER ---
const roster = [
  { id:"battaglia-riccardo", name:"BATTAGLIA RICCARDO", last:"BATTAGLIA", first:"RICCARDO", photo:"photos/riccardo.jpg" },
  { id:"benmimoun-amir", name:"BENMIMOUN AMIR", last:"BENMIMOUN", first:"AMIR", photo:"photos/amir.jpg" },
  { id:"benmimoun-hedi", name:"BENMIMOUN HEDI", last:"BENMIMOUN", first:"HEDI", photo:"photos/hedi.jpg" },
  { id:"buriola-elia", name:"BURIOLA ELIA", last:"BURIOLA", first:"ELIA", photo:"photos/elia.jpg" },
  { id:"casonato-christian", name:"CASONATO CHRISTIAN", last:"CASONATO", first:"CHRISTIAN", photo:"photos/christian.jpg" },
  { id:"degiusti-giacomo", name:"DE GIUSTI GIACOMO", last:"DE GIUSTI", first:"GIACOMO", photo:"photos/giacomo.jpg" },
  { id:"ghirardo-gabriel", name:"GHIRARDO GABRIEL", last:"GHIRARDO", first:"GABRIEL", photo:"photos/gabriel.jpg" },
  { id:"ghirardo-gianmaria", name:"GHIRARDO GIANMARIA", last:"GHIRARDO", first:"GIANMARIA", photo:"photos/gianmaria.jpg" },
  { id:"guz-patrick", name:"GUZ PATRICK", last:"GUZ", first:"PATRICK", photo:"photos/patrick.jpg" },
  { id:"hallulli-leon", name:"HALLULLI LEON", last:"HALLULLI", first:"LEON", photo:"photos/leon.jpg" },
  { id:"marku-orest", name:"MARKU OREST", last:"MARKU", first:"OREST", photo:"photos/orest.jpg" },
  { id:"sonego-leonardo", name:"SONEGO LEONARDO", last:"SONEGO", first:"LEONARDO", photo:"photos/leonardo.jpg" },
  { id:"zuliani-evan", name:"ZULIANI EVAN", last:"ZULIANI", first:"EVAN", photo:"photos/evan.jpg" },
];

const $ = (id) => document.getElementById(id);
const safe = (el) => el !== null && el !== undefined;

function lsGet(key, fallback){
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch(e) {
    console.warn("lsGet failed", key, e);
    return fallback;
  }
}
function lsSet(key, value){
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch(e) {
    console.warn("lsSet failed", key, e);
  }
}

function fmtDate(itIso) {
  const parts = itIso.split("-");
  const d = parts[2], m = parts[1];
  return d + "/" + m;
}

function monthKey(year, monthIndex0) {
  const m = String(monthIndex0+1).padStart(2,"0");
  return String(year) + "-" + m;
}

function parseMonthKey(k) {
  const parts = k.split("-");
  return { y: Number(parts[0]), mIndex0: Number(parts[1]) - 1 };
}

function getTrainingDates(year, monthIndex0) {
  const days = [];
  const d = new Date(year, monthIndex0, 1);
  while (d.getMonth() === monthIndex0) {
    const dow = d.getDay(); // 0 Sun .. 6 Sat
    if (dow === 1 || dow === 3 || dow === 4) {
      days.push(d.toISOString().slice(0,10));
    }
    d.setDate(d.getDate()+1);
  }
  return days;
}

// --- Tabs ---
function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      tabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const key = btn.dataset.tab;
      ["presenze","rosa","tattiche"].forEach(k => {
        const sec = $("tab-"+k);
        if (safe(sec)) sec.style.display = (k===key) ? "" : "none";
      });
    });
  });
}

// --- Modal player ---
function initPlayerModal() {
  const modal = $("playerModal");
  const close = $("closeModal");
  function hide(){
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden","true");
  }
  close.addEventListener("click", hide);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) hide();
  });

  window.showPlayer = (p) => {
    $("modalName").textContent = p.name;
    $("modalSub").textContent = "Scheda giocatore";
    $("modalInfo").textContent = "Foto e dati base. (Statistiche mese: usa Presenze → Riepilogo mese)";
    const img = $("modalImg");
    img.src = p.photo || "placeholder.png";
    img.alt = p.name;
    img.onerror = () => { img.src="placeholder.png"; };
    modal.classList.add("show");
    modal.setAttribute("aria-hidden","false");
  };
}

// --- ROSA ---
function renderRoster() {
  const wrap = $("rosterList");
  if (!safe(wrap)) return;
  wrap.innerHTML = "";
  roster.forEach(p => {
    const div = document.createElement("div");
    div.className = "player";
    div.innerHTML = `
      <div class="avatar"><img alt="${p.name}" src="${p.photo}" onerror="this.src='placeholder.png'"></div>
      <div>
        <div class="pname">${p.last}</div>
        <div class="psub">${p.first}</div>
      </div>
    `;
    div.addEventListener("pointerup", (e) => {
      e.preventDefault();
      window.showPlayer(p);
    }, {passive:false});
    wrap.appendChild(div);
  });
}

// --- PRESENZE ---
let dirty = false;
let currentSelection = { year:null, mIndex0:null, dateIso:null };
let dayAttendanceDraft = {}; // playerId -> bool

function setDirty(v){
  dirty = v;
  const sticky = $("stickyActions");
  const hint = $("saveHint");
  if (safe(sticky)) sticky.style.display = dirty ? "" : "none";
  if (safe(hint)) hint.textContent = dirty ? "Modifiche non salvate." : "Nessuna modifica.";
}

function getAttendanceStore(){
  return lsGet("attendance", {}); // { monthKey: { dateIso: {playerId:true} } }
}
function setAttendanceStore(store){
  lsSet("attendance", store);
}

function initYearMonthSelectors(){
  const yearSel = $("yearSel");
  const monthSel = $("monthSel");
  const dateSel = $("dateSel");
  if (!safe(yearSel) || !safe(monthSel) || !safe(dateSel)) return;

  const now = new Date();
  const y0 = now.getFullYear();

  yearSel.innerHTML = "";
  for (let y=y0-2; y<=y0+2; y++){
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    yearSel.appendChild(opt);
  }

  const mesi = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
  monthSel.innerHTML = "";
  mesi.forEach((m, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = m;
    monthSel.appendChild(opt);
  });

  yearSel.value = String(y0);
  monthSel.value = String(now.getMonth());

  function refreshDates(){
    const year = Number(yearSel.value);
    const mIndex0 = Number(monthSel.value);
    currentSelection.year = year;
    currentSelection.mIndex0 = mIndex0;
    currentSelection.dateIso = null;

    dateSel.innerHTML = `<option value="">Seleziona giornata</option>`;
    const dates = getTrainingDates(year, mIndex0);
    dates.forEach(iso => {
      const opt = document.createElement("option");
      opt.value = iso;
      opt.textContent = fmtDate(iso) + " • " + iso;
      dateSel.appendChild(opt);
    });

    renderMonthSummary();
    renderAttendanceEditor();
  }

  yearSel.addEventListener("change", () => {
    if (dirty && !confirm("Hai modifiche non salvate. Cambiare mese/anno e perdere le modifiche?")){
      yearSel.value = String(currentSelection.year ?? y0);
      return;
    }
    setDirty(false);
    refreshDates();
  });

  monthSel.addEventListener("change", () => {
    if (dirty && !confirm("Hai modifiche non salvate. Cambiare mese e perdere le modifiche?")){
      monthSel.value = String(currentSelection.mIndex0 ?? now.getMonth());
      return;
    }
    setDirty(false);
    refreshDates();
  });

  dateSel.addEventListener("change", () => {
    if (dirty && !confirm("Hai modifiche non salvate. Cambiare giornata e perdere le modifiche?")){
      dateSel.value = currentSelection.dateIso ?? "";
      return;
    }
    setDirty(false);
    currentSelection.dateIso = dateSel.value || null;
    renderAttendanceEditor();
  });

  refreshDates();
}

function loadDayAttendance(monthK, dateIso){
  const store = getAttendanceStore();
  const m = store[monthK] || {};
  return m[dateIso] || {};
}

function renderAttendanceEditor(){
  const area = $("attendanceArea");
  if (!safe(area)) return;

  if (!currentSelection.year || currentSelection.mIndex0 === null){
    area.textContent = "Seleziona anno e mese.";
    return;
  }
  if (!currentSelection.dateIso){
    area.textContent = "Seleziona una giornata dal menu.";
    return;
  }

  const mk = monthKey(currentSelection.year, currentSelection.mIndex0);
  const saved = loadDayAttendance(mk, currentSelection.dateIso);

  dayAttendanceDraft = {};
  roster.forEach(p => { dayAttendanceDraft[p.id] = !!saved[p.id]; });

  const wrap = document.createElement("div");
  wrap.className = "checklist";

  roster.forEach(p => {
    const row = document.createElement("div");
    row.className = "check";
    row.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <div class="avatar" style="width:34px;height:34px;"><img src="${p.photo}" onerror="this.src='placeholder.png'"></div>
        <div><b>${p.last}</b><div class="muted" style="margin-top:2px;">${p.first}</div></div>
      </div>
      <input type="checkbox" aria-label="Presente ${p.name}" ${dayAttendanceDraft[p.id] ? "checked":""}>
    `;
    const cb = row.querySelector("input[type=checkbox]");
    cb.addEventListener("change", () => {
      dayAttendanceDraft[p.id] = cb.checked;
      setDirty(true);
      renderMonthSummary();
    });

    const av = row.querySelector(".avatar");
    av.addEventListener("pointerup", (e) => {
      e.preventDefault();
      window.showPlayer(p);
    }, {passive:false});

    wrap.appendChild(row);
  });

  area.innerHTML = "";
  const head = document.createElement("div");
  head.innerHTML = `<div class="muted">Giornata: <b style="color:var(--text)">${currentSelection.dateIso}</b></div>`;
  area.appendChild(head);
  area.appendChild(wrap);
}

function saveCurrentDay(){
  if (!currentSelection.year || currentSelection.mIndex0 === null || !currentSelection.dateIso) return;

  const mk = monthKey(currentSelection.year, currentSelection.mIndex0);
  const store = getAttendanceStore();
  if (!store[mk]) store[mk] = {};

  const packed = {};
  Object.keys(dayAttendanceDraft).forEach(pid => {
    if (dayAttendanceDraft[pid]) packed[pid] = true;
  });
  store[mk][currentSelection.dateIso] = packed;
  setAttendanceStore(store);
  setDirty(false);
  renderMonthSummary();
}

function calcMonthStats(mk){
  const store = getAttendanceStore();
  const m = store[mk] || {};
  const info = parseMonthKey(mk);
  const allTrainings = getTrainingDates(info.y, info.mIndex0);

  const byPlayer = {};
  roster.forEach(p => { byPlayer[p.id] = { present:0, total:0 }; });

  allTrainings.forEach(d => {
    roster.forEach(p => byPlayer[p.id].total++);
    const day = m[d] || {};
    roster.forEach(p => { if (day[p.id]) byPlayer[p.id].present++; });
  });

  return { allTrainings, byPlayer };
}

function renderMonthSummary(){
  const wrap = $("monthSummary");
  if (!safe(wrap)) return;

  if (!currentSelection.year || currentSelection.mIndex0 === null){
    wrap.textContent = "Seleziona un mese.";
    return;
  }

  const mk = monthKey(currentSelection.year, currentSelection.mIndex0);
  const stats = calcMonthStats(mk);

  const totalSessions = stats.allTrainings.length;
  if (totalSessions === 0){
    wrap.textContent = "Nessuna giornata di allenamento nel mese.";
    return;
  }

  const div = document.createElement("div");
  div.className = "checklist";
  roster.forEach(p => {
    const s = stats.byPlayer[p.id];
    const perc = s.total ? Math.round((s.present / s.total)*100) : 0;
    const row = document.createElement("div");
    row.className = "check";
    row.innerHTML = `
      <div>
        <b>${p.last}</b>
        <div class="muted">${p.first}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:900;">${s.present}/${s.total}</div>
        <div class="muted">${perc}%</div>
      </div>
    `;
    div.appendChild(row);
  });

  wrap.innerHTML = `
    <div class="muted">Allenamenti nel mese (Lun/Mer/Gio): <b style="color:var(--text)">${totalSessions}</b></div>
    <div class="muted" style="margin-top:6px;">Suggerimento: seleziona una giornata e spunta i presenti, poi SALVA.</div>
  `;
  const d = document.createElement("div"); d.className="divider"; wrap.appendChild(d);
  wrap.appendChild(div);
}

function printMonthPDF(){
  if (!currentSelection.year || currentSelection.mIndex0 === null){
    alert("Seleziona anno e mese.");
    return;
  }
  const mk = monthKey(currentSelection.year, currentSelection.mIndex0);
  const stats = calcMonthStats(mk);
  const monthName = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"][currentSelection.mIndex0];

  const store = getAttendanceStore();
  const m = store[mk] || {};

  const rows = roster.map(p => {
    const s = stats.byPlayer[p.id];
    const abs = s.total - s.present;
    const perc = s.total ? Math.round((s.present/s.total)*100) : 0;
    return `<tr>
      <td>${p.name}</td>
      <td style="text-align:center">${s.present}</td>
      <td style="text-align:center">${abs}</td>
      <td style="text-align:center">${s.total}</td>
      <td style="text-align:center">${perc}%</td>
    </tr>`;
  }).join("");

  const dayBlocks = stats.allTrainings.map(iso => {
    const day = m[iso] || {};
    const presenti = roster.filter(p => day[p.id]).map(p => p.last + " " + p.first).join(", ") || "—";
    return `<div style="margin:10px 0; padding:10px; border:1px solid #ddd; border-radius:10px;">
      <b>${iso}</b><div style="margin-top:6px;"><b>Presenti:</b> ${presenti}</div>
    </div>`;
  }).join("");

  const html = `
<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Report ${monthName} ${currentSelection.year}</title>
<style>
  body{font-family: Arial, sans-serif; padding:16px; color:#111;}
  h1{margin:0 0 8px; font-size:18px;}
  .muted{color:#555; font-size:12px;}
  table{width:100%; border-collapse:collapse; margin-top:12px;}
  th,td{border:1px solid #ddd; padding:8px; font-size:12px;}
  th{background:#f6f6f6;}
  @media print { button{display:none;} }
</style>
</head>
<body>
  <button onclick="window.print()" style="padding:10px 12px; font-weight:700;">Stampa / Salva PDF</button>
  <h1>Presenze — ${monthName} ${currentSelection.year}</h1>
  <div class="muted">Allenamenti considerati: Lun/Mer/Gio — Totale giornate: ${stats.allTrainings.length}</div>

  <table>
    <thead><tr>
      <th>Giocatore</th><th>Presenze</th><th>Assenze</th><th>Totale</th><th>%</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <h2 style="margin-top:18px; font-size:14px;">Dettaglio giornate</h2>
  ${dayBlocks}

  <div class="muted" style="margin-top:14px;">Generato da Fabrizio Coach • v29 (2.1)</div>
</body></html>`;

  const w = window.open("", "_blank");
  if (w){
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    return;
  }
  const iframe = document.createElement("iframe");
  iframe.style.position="fixed";
  iframe.style.right="0";
  iframe.style.bottom="0";
  iframe.style.width="0";
  iframe.style.height="0";
  iframe.style.border="0";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(()=>iframe.remove(), 1500);
  }, 300);
}

function initPresenze(){
  initYearMonthSelectors();
  const btnSave = $("btnSaveDay");
  if (safe(btnSave)){
    btnSave.addEventListener("click", () => {
      saveCurrentDay();
      $("stickyLabel").textContent = "Salvato ✓";
      setTimeout(()=>{$("stickyLabel").textContent="Modifiche";}, 900);
    });
  }
  const btnPrint = $("btnPrintMonth");
  if (safe(btnPrint)) btnPrint.addEventListener("click", printMonthPDF);
}

// --- TATTICHE ---
let pitchMarkers = [];
let fsOn = false;

function getTacticsStore(){ return lsGet("tactics", { markers:[] }); }
function setTacticsStore(s){ lsSet("tactics", s); }

function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }

function renderBench(){
  const bench = $("bench");
  if (!safe(bench)) return;
  bench.innerHTML = "";
  roster.forEach(p => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.innerHTML = `
      <div class="cava"><img src="${p.photo}" onerror="this.src='placeholder.png'"></div>
      <b>${p.last}</b>
    `;
    chip.addEventListener("pointerup", (e) => {
      e.preventDefault();
      addMarkerForPlayer(p.id);
    }, {passive:false});
    bench.appendChild(chip);
  });
}

function addMarkerForPlayer(playerId){
  const overlay = $("pitchOverlay");
  if (!safe(overlay)) return;
  const id = "m_" + Math.random().toString(16).slice(2);
  pitchMarkers.push({ id, playerId, x:0.5, y:0.5 });
  persistMarkers();
  drawMarkers();
}

function persistMarkers(){ setTacticsStore({ markers: pitchMarkers }); }
function loadMarkers(){
  const s = getTacticsStore();
  pitchMarkers = Array.isArray(s.markers) ? s.markers : [];
}

function drawMarkers(){
  const overlay = $("pitchOverlay");
  if (!safe(overlay)) return;
  overlay.innerHTML = "";

  pitchMarkers.forEach(m => {
    const p = roster.find(r=>r.id===m.playerId);
    const el = document.createElement("div");
    el.className = "marker";
    el.dataset.mid = m.id;
    el.style.left = `calc(${m.x*100}% - 24px)`;
    el.style.top  = `calc(${m.y*100}% - 24px)`;
    const imgSrc = (p && p.photo) ? p.photo : "placeholder.png";
    el.innerHTML = `<img src="${imgSrc}" onerror="this.src='placeholder.png'">`;

    let dragging = false;
    const onDown = (ev) => {
      dragging = true;
      el.setPointerCapture(ev.pointerId);
    };
    const onMove = (ev) => {
      if (!dragging) return;
      const rect = overlay.getBoundingClientRect();
      const nx = clamp((ev.clientX - rect.left)/rect.width, 0.02, 0.98);
      const ny = clamp((ev.clientY - rect.top)/rect.height, 0.02, 0.98);
      m.x = nx; m.y = ny;
      el.style.left = `calc(${m.x*100}% - 24px)`;
      el.style.top  = `calc(${m.y*100}% - 24px)`;
    };
    const onUp = () => {
      if (!dragging) return;
      dragging=false;
      persistMarkers();
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);

    let pressTimer = null;
    el.addEventListener("pointerdown", () => {
      pressTimer = setTimeout(() => {
        if (confirm("Rimuovere questo giocatore dal campo?")){
          pitchMarkers = pitchMarkers.filter(mm=>mm.id!==m.id);
          persistMarkers();
          drawMarkers();
        }
      }, 650);
    });
    el.addEventListener("pointerup", () => { if (pressTimer) clearTimeout(pressTimer); });
    el.addEventListener("pointercancel", () => { if (pressTimer) clearTimeout(pressTimer); });

    overlay.appendChild(el);
  });
}

function toggleFullscreen(){
  const wrap = $("pitchWrap");
  if (!safe(wrap)) return;
  fsOn = !fsOn;
  wrap.classList.toggle("fullscreen", fsOn);
}

function initTattiche(){
  renderBench();
  loadMarkers();
  drawMarkers();

  const btnFs = $("btnToggleFs");
  if (safe(btnFs)) btnFs.addEventListener("click", toggleFullscreen);

  const btnClear = $("btnClearPitch");
  if (safe(btnClear)) btnClear.addEventListener("click", () => {
    if (!confirm("Pulire il campo?")) return;
    pitchMarkers = [];
    persistMarkers();
    drawMarkers();
  });

  const wrap = $("pitchWrap");
  if (safe(wrap)){
    let last = 0;
    wrap.addEventListener("pointerup", () => {
      const now = Date.now();
      if (now - last < 280) toggleFullscreen();
      last = now;
    });
  }
}

// --- Reset ---
function initReset(){
  const btn = $("btnResetAll");
  if (!safe(btn)) return;
  btn.addEventListener("click", () => {
    if (!confirm("Vuoi azzerare TUTTI i dati (presenze + tattiche) su questo dispositivo?")) return;
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(STORAGE_PREFIX)) localStorage.removeItem(k);
    });
    alert("Dati azzerati.");
    location.reload();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    initTabs();
    initPlayerModal();
    renderRoster();
    initPresenze();
    initTattiche();
    initReset();
    setDirty(false);
  } catch (e) {
    console.error("Fatal init error", e);
    alert("Errore di avvio: " + (e && e.message ? e.message : e));
  }
});
