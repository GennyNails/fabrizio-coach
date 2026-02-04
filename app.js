
const APP_VERSION = "1.2";
const STORE_KEY = "mister_soccer_v17";

const CATEGORIES = ["Primi Calci", "Piccoli Amici", "Pulcini 1° anno", "Pulcini 2° anno", "Pulcini Misti", "Esordienti 1° Anno", "Esordienti 2° Anno", "Esordienti Misti", "Giovanissimi (U14)", "Giovanissimi (U15)", "Allievi"];

const PLACEHOLDER_PHOTO = "placeholder.png";

const PHOTO_MAP = {"BATTAGLIA RICCARDO": "photos/riccardo.jpg", "ZULIANI EVAN": "photos/evan.jpg", "MARKU OREST": "photos/orest.jpg", "GHIRARDO GABRIEL": "photos/gabriel.jpg", "BENMIMOUN AMIR": "photos/amir.jpg", "GHIRARDO GIANMARIA": "photos/gianmaria.jpg", "CASONATO CHRISTIAN": "photos/christian.jpg", "DE GIUSTI GIACOMO": "photos/giacomo.jpg", "BENMIMOUN HEDI": "photos/hedi.jpg", "SONEGO LEONARDO": "photos/leonardo.jpg", "BURIOLA ELIA": "photos/elia.jpg", "HALLULLI LEON": "photos/leon.jpg", "GUZ PATRICK": "photos/patrick.jpg"};
const LEGACY_KEYS = ["mister_fab_v4", "mister_fab_v3", "mister_fab_v2"];
const ROLES = ["portiere","difensore","centrocampista","ala sx","ala destra","attaccante"];
const DEFAULT_ROSTER = [{"name": "BATTAGLIA RICCARDO", "role": "centrocampista"}, {"name": "BENMIMOUN AMIR", "role": "centrocampista"}, {"name": "BENMIMOUN HEDI", "role": "centrocampista"}, {"name": "BURIOLA ELIA", "role": "centrocampista"}, {"name": "CASONATO CHRISTIAN", "role": "centrocampista"}, {"name": "DE GIUSTI GIACOMO", "role": "centrocampista"}, {"name": "GHIRARDO GABRIEL", "role": "centrocampista"}, {"name": "GHIRARDO GIANMARIA", "role": "centrocampista"}, {"name": "GUZ PATRICK", "role": "centrocampista"}, {"name": "HALLULLI LEON", "role": "centrocampista"}, {"name": "MARKU OREST", "role": "centrocampista"}, {"name": "SONEGO LEONARDO", "role": "centrocampista"}, {"name": "ZULIANI EVAN", "role": "centrocampista"}];

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

function migrateLegacyIfAny() {
  // Se esiste già STORE_KEY, non migrare.
  if (localStorage.getItem(STORE_KEY)) return null;

  for (const k of LEGACY_KEYS) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    try {
      const old = JSON.parse(raw);
      // Attesi: roster (stringhe o oggetti), attendance, matches
      const roster = Array.isArray(old.roster)
        ? old.roster.map(p => (typeof p === "string" ? {name:p, role:"centrocampista"} : {
            name: p.name ?? String(p),
            role: (p.role || (Array.isArray(p.roles) ? (p.roles[0] || "centrocampista") : "centrocampista"))
          }))
        : structuredClone(DEFAULT_ROSTER);

      const attendance = old.attendance && typeof old.attendance === "object" ? old.attendance : {};
      const matches = Array.isArray(old.matches) ? old.matches : [];

      return { roster, attendance, matches };
    } catch {}
  }
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
      return { roster: structuredClone(DEFAULT_ROSTER), attendance: {}, matches: [] };
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
    return s;
  } catch {
    return { roster: structuredClone(DEFAULT_ROSTER), attendance: {}, matches: [] };
  }
}

function saveState() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

function rosterNames() { return state.roster.map(p => p.name); }
function escapeHtml(str) {
  return (str ?? "").toString()
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

// ----------------- STATE -----------------
let state = loadState();
normalizeRoster();
  if(!state.profile) state.profile = { coachName:"", category: CATEGORIES[0] };
  if(typeof state.teamLogo !== "string") state.teamLogo = "";

let selectedSessionId = null;

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
  tabPartite: document.getElementById("tab-partite"),
  tabReport: document.getElementById("tab-report"),
  tabTattiche: document.getElementById("tab-tattiche"),

  // Presenze
  monthPick: document.getElementById("monthPick"),
  extraDate: document.getElementById("extraDate"),
  ensureMonthBtn: document.getElementById("ensureMonthBtn"),
  addExtraBtn: document.getElementById("addExtraBtn"),
  deleteMonthBtn: document.getElementById("deleteMonthBtn"),
  sessionsTbody: document.getElementById("sessionsTbody"),
  noSessions: document.getElementById("noSessions"),
  sessionSelect: document.getElementById("sessionSelect"),
  saveAttendanceBtn: document.getElementById("saveAttendanceBtn"),
  selectedSessionBadge: document.getElementById("selectedSessionBadge"),
  monthTotalBadge: document.getElementById("monthTotalBadge"),
  attendanceTbody: document.getElementById("attendanceTbody"),
  noSessionSelected: document.getElementById("noSessionSelected"),
  setAllPresentBtn: document.getElementById("setAllPresentBtn"),
  setAllAbsentBtn: document.getElementById("setAllAbsentBtn"),
  clearMarksBtn: document.getElementById("clearMarksBtn"),
  percentTbody: document.getElementById("percentTbody"),

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
  el.tabReport.classList.toggle("hidden", which !== "report");
  el.tabTattiche.classList.toggle("hidden", which !== "tattiche");
  if (which === "report") renderReport();
  if (which === "tattiche") tacticsRenderAll();
}
el.tabButtons.forEach(btn => btn.addEventListener("click", () => showTab(btn.dataset.tab)));

// ----------------- PRESENZE: lun/mer/gio auto -----------------
function getSelectedMonth() { return el.monthPick.value || monthISO(todayISO()); }

function monthAutoDates(month) {
  // month: YYYY-MM
  const [Y,M] = month.split("-").map(Number);
  const d = new Date(Y, M-1, 1);
  const out = [];
  const pad = (n) => String(n).padStart(2,"0");
  while (d.getMonth() === (M-1)) {
    const dow = d.getDay(); // 0 dom, 1 lun, 3 mer, 4 gio
    if (dow === 1 || dow === 3 || dow === 4) {
      out.push(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`);
    }
    d.setDate(d.getDate()+1);
  }
  return out;
}

function getMonthData(month) {
  if (!state.attendance[month]) state.attendance[month] = { sessions: [] };
  return state.attendance[month];
}

function ensureMarks(session) {
  if (!session.marks || typeof session.marks !== "object") session.marks = {};
}

function ensureMonthGenerated() {
  const month = getSelectedMonth();
  const md = getMonthData(month);
  const autos = monthAutoDates(month);

  // aggiungi date automatiche mancanti
  for (const date of autos) {
    if (!md.sessions.some(s => s.date === date)) md.sessions.push({ id: uid(), date, marks: {} });
  }

  // ordina
  md.sessions.sort((a,b)=>(a.date||"").localeCompare(b.date||""));

  saveState();
  renderPresenzeAll();
  renderReportMonths();
}

function addExtraDay() {
  const month = getSelectedMonth();
  const date = el.extraDate.value;
  if (!date) return alert("Seleziona una data extra.");
  if (monthISO(date) !== month) return alert("La data extra deve essere nello stesso mese selezionato.");
  const md = getMonthData(month);
  if (md.sessions.some(s => s.date === date)) return alert("Questa giornata esiste già.");
  md.sessions.push({ id: uid(), date, marks: {} });
  md.sessions.sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  saveState();
  renderPresenzeAll();
  renderReportMonths();
}

function deleteMonth() {
  const month = getSelectedMonth();
  if (!confirm(`Vuoi eliminare tutte le presenze del mese ${month}?`)) return;
  delete state.attendance[month];
  selectedSessionId = null;
  saveState();
  renderPresenzeAll();
  renderReportMonths();
}

function countPA(session){
  let p = 0;
  const names = rosterNames();
  for(const name of names){
    const m = session.marks?.[name] || "";
    if(m === "P") p++;
  }
  const a = Math.max(0, names.length - p);
  return {p,a};
}

function removeSession(sessionId) {
  const month = getSelectedMonth();
  const md = getMonthData(month);
  const s = md.sessions.find(x => x.id === sessionId);
  if (!s) return;
  if (!confirm(`Eliminare la giornata ${s.date}?`)) return;
  md.sessions = md.sessions.filter(x => x.id !== sessionId);
  if (selectedSessionId === sessionId) selectedSessionId = null;
  saveState();
  renderPresenzeAll();
  renderReportMonths();
}

function selectSession(sessionId) {
  selectedSessionId = sessionId;
  renderSessions();
  renderAttendanceEditor();
}

function setMark(month, sessionId, playerName, mark) {
  const md = getMonthData(month);
  const s = md.sessions.find(x => x.id === sessionId);
  if (!s) return;
  ensureMarks(s);
  if (mark === "") delete s.marks[playerName];
  else s.marks[playerName] = mark;
  saveState();
}

function setAllMarks(mark) {
  const month = getSelectedMonth();
  const md = getMonthData(month);
  const s = md.sessions.find(x => x.id === selectedSessionId);
  if (!s) return;
  ensureMarks(s);
  for (const name of rosterNames()) {
    if (mark === "") delete s.marks[name];
    else s.marks[name] = mark;
  }
  saveState();
  renderPresenzeAll();
  renderReport(); // aggiorna report se aperto
}

function renderSessions(){
  const m = state.data.presenzeByMonth[state.monthKey];
  const sessions = (m && m.sessions) ? m.sessions : [];
  el.monthTotalBadge.textContent = String(sessions.length);

  if(!el.sessionSelect){
    // fallback to old UI if any
    return;
  }

  el.sessionSelect.innerHTML = "";
  if(!sessions.length){
    el.noSessions.classList.remove("hidden");
    el.sessionSelect.disabled = true;
    selectedSessionId = null;
    el.selectedSessionBadge.textContent = "—";
    renderAttendanceEditor();
    return;
  }

  el.noSessions.classList.add("hidden");
  el.sessionSelect.disabled = false;

  sessions
    .slice()
    .sort((a,b)=>a.date.localeCompare(b.date))
    .forEach(s=>{
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = formatDateLong(s.date);
      el.sessionSelect.appendChild(opt);
    });

  const exists = sessions.some(s=>s.id===selectedSessionId);
  if(!selectedSessionId || !exists) selectedSessionId = sessions[0].id;

  el.sessionSelect.value = selectedSessionId;

  const selSession = sessions.find(s=>s.id===selectedSessionId);
  el.selectedSessionBadge.textContent = selSession ? formatDateLong(selSession.date) : "—";

  renderAttendanceEditor();
}

function renderAttendanceEditor(){
  const m = state.data.presenzeByMonth[state.monthKey];
  const sessions = (m && m.sessions) ? m.sessions : [];
  const sid = selectedSessionId;

  el.attendanceTbody.innerHTML = "";

  if(!sid){
    el.noSessionSelected.classList.remove("hidden");
    return;
  }

  const session = sessions.find(s=>s.id===sid);
  if(!session){
    el.noSessionSelected.classList.remove("hidden");
    return;
  }

  el.noSessionSelected.classList.add("hidden");

  const roster = state.data.roster;
  roster.forEach(p=>{
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = p.name;
    tr.appendChild(tdName);

    const tdChk = document.createElement("td");
    tdChk.className = "right";
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = (session.marks && session.marks[p.name] === "P");
    chk.addEventListener("change", ()=>{
      session.marks = session.marks || {};
      session.marks[p.name] = chk.checked ? "P" : "";
      persist();
      // update the monthly percentage table immediately
      renderPercentuali();
      // update report if user is on report
      if(state.page==="report") renderReport();
    });
    tdChk.appendChild(chk);
    tr.appendChild(tdChk);

    el.attendanceTbody.appendChild(tr);
  });
}

function renderPercentages() {
  const month = getSelectedMonth();
  const md = getMonthData(month);
  const sessions = (md.sessions || []);
  const total = sessions.length;

  el.percentTbody.innerHTML = "";
  for (const name of rosterNames()) {
    let present = 0;
    for (const s of sessions) if ((s.marks?.[name] || "") === "P") present++;
    const pct = total ? Math.round((present/total)*100) : 0;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(name)}</td>
      <td class="right">${present}</td>
      <td class="right">${total}</td>
      <td class="right"><span class="badge ${pct>=75 ? "ok" : ""}">${pct}%</span></td>
    `;
    el.percentTbody.appendChild(tr);
  }
}

function renderPresenzeAll() {
  renderSessions();
  renderAttendanceEditor();
  renderPercentages();
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
  el.rosterList.innerHTML = "";
  el.pillInfo.textContent = `Rosa: ${state.roster.length}`;

  // datalist report
  el.playerList.innerHTML = "";
  for (const n of rosterNames()) {
    const opt = document.createElement("option");
    opt.value = n;
    el.playerList.appendChild(opt);
  }

  // capitano/vice e panchina tattiche
  renderCaptainViceOptions();
  renderBench();

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
    if(av){ av.classList.add("clickable"); av.addEventListener("click", ()=> openPlayerModal(p.name)); }


    fillRoleSelect(role1, (p.roles && p.roles[0], false) ? p.roles[0] : "centrocampista", false);
    fillRoleSelect(role2, (p.roles && p.roles[1], false) ? p.roles[1] : "", true);

    numInput.addEventListener("input", ()=>{ numPrev.textContent = numInput.value.trim(); });

    item.querySelector("button[data-save]").addEventListener("click", () => {
      const roles = [role1.value, role2.value].filter(Boolean).slice(0,2);
      p.roles = roles.length ? roles : ["centrocampista"];
      p.number = numInput.value.trim();
      saveState();
      renderBench();
      renderReport();
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
  state.roster.push({ name, role: ROLES.includes(role) ? role : "centrocampista" });
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
  renderReport();
}

function resetRoster() {
  if (!confirm("Ripristinare i 13 giocatori?")) return;
  state.roster = structuredClone(DEFAULT_ROSTER);
  saveState();
  renderRoster();
  renderPresenzeAll();
  renderMatches();
  renderReport();
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
  renderReport();
  resetMatchForm();
}

function removeMatch(id) {
  const m = state.matches.find(x => x.id === id);
  if (!m) return;
  if (!confirm(`Eliminare partita del ${m.date} vs ${m.opponent || "—"}?`)) return;
  state.matches = state.matches.filter(x => x.id !== id);
  saveState();
  renderMatches();
  renderReport();
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
    if (md?.sessions?.length) sessions = sessions.concat(md.sessions.map(s => ({...s, _month:m})));
  }
  const total = sessions.length;

  const rows = names.map(n => {
    let p=0,a=0;
    for (const s of sessions) {
      const mark = s.marks?.[n] || "";
      if (mark === "P") p++;
      else if (mark === "A") a++;
    }
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
    else if (m === "A") absent++;
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
    else if (mark==="A") r.a++;
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
        <div class="center"><span class="badge">${escapeHtml(p.role || "—")}</span></div>
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
el.ensureMonthBtn.addEventListener("click", ensureMonthGenerated);
el.addExtraBtn.addEventListener("click", addExtraDay);
el.deleteMonthBtn.addEventListener("click", deleteMonth);
el.monthPick.addEventListener("change", () => {
  selectedSessionId = null;
  ensureMonthGenerated();
  renderPresenzeAll();
  renderReport();
});

if(el.sessionSelect){
  el.sessionSelect.addEventListener("change", ()=>{
    selectedSessionId = el.sessionSelect.value;
    renderSessions();
  });
}

if(el.saveAttendanceBtn){
  el.saveAttendanceBtn.addEventListener("click", ()=>{
    toast("Salvato ✓");
  });
}


el.setAllPresentBtn.addEventListener("click", () => setAllMarks("P"));
el.setAllAbsentBtn.addEventListener("click", () => setAllMarks(""));
el.clearMarksBtn.addEventListener("click", () => setAllMarks(""));

fillRoleSelect(el.newPlayerRole, "centrocampista", false);
el.addPlayerBtn.addEventListener("click", addPlayer);
el.newPlayerName.addEventListener("keydown", (e)=>{ if (e.key==="Enter") addPlayer(); });
el.resetRosterBtn.addEventListener("click", resetRoster);

el.saveMatchBtn.addEventListener("click", saveMatch);
el.resetMatchBtn.addEventListener("click", resetMatchForm);

el.playerSearch.addEventListener("input", renderReport);
el.clearPlayerSearchBtn.addEventListener("click", ()=>{ el.playerSearch.value=""; renderReport(); });
el.reportMode.addEventListener("change", renderReport);
el.reportMonth.addEventListener("change", renderReport);

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
el.monthPick.value = tday.slice(0,7);
el.extraDate.value = tday;
el.matchDate.value = tday;

renderRoster();
renderMatches();
ensureMonthGenerated();
renderPresenzeAll();
resetMatchForm();
renderReportMonths();
renderReport();

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
