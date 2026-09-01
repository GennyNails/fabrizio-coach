/* Mister Fab 5.0.3 */
// App version (usata anche nel PDF e nel Service Worker cache-bust)
const VERSION = "5.0.3";
const APP_NAME = "Mister Fab";
const STORAGE_PREFIX = "misterfab3_01:";

const ROLES = ["", "portiere", "difensore", "centrocampista", "ala destra", "ala sinistra", "attaccante"];
const CATEGORIES = ["Esordienti • 9 vs 9"];
const FIXED_TRAINING_DAYS = [1,3,4];

const Storage = {
  key(key){ return STORAGE_PREFIX + key; },
  get(key, fallback){
    try{
      const raw = localStorage.getItem(Storage.key(key));
      return raw ? JSON.parse(raw) : fallback;
    }catch(_){ return fallback; }
  },
  set(key, value){ localStorage.setItem(Storage.key(key), JSON.stringify(value)); },
  remove(key){ localStorage.removeItem(Storage.key(key)); },
};

// hook (inizializzato dopo la creazione di Cloud)
let __onStorageSet = null;
(()=>{
  const _set = Storage.set.bind(Storage);
  Storage.set = (key, value)=>{
    _set(key, value);
    try{ __onStorageSet && __onStorageSet(key); }catch(_){ /* no-op */ }
  };
})();

const Utils = {
  pad2(n){ return String(n).padStart(2,"0"); },
  monthKey(d){ return `${d.getFullYear()}-${Utils.pad2(d.getMonth()+1)}`; },
  // ISO date (YYYY-MM-DD) in local time
  isoDate(d){
    return `${d.getFullYear()}-${Utils.pad2(d.getMonth()+1)}-${Utils.pad2(d.getDate())}`;
  },
  toISO(y,m,day){ return `${y}-${Utils.pad2(m)}-${Utils.pad2(day)}`; },
  itMonth(i){ return ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"][i]; },
  itWdShort(d){ return ["Dom","Lun","Mar","Mer","Gio","Ven","Sab"][d]; },
  itDate(d){ const x = d instanceof Date ? d : new Date(d); return Number.isNaN(x.getTime()) ? "—" : `${Utils.pad2(x.getDate())}/${Utils.pad2(x.getMonth()+1)}/${x.getFullYear()}`; },
  initials(full){
    const p=(full||"").trim().split(/\s+/).filter(Boolean);
    const a=p[0]?.[0]||""; const b=p[1]?.[0]||p[0]?.[1]||"";
    return (a+b).toUpperCase();
  },
  fileToDataURL(file){
    return new Promise((resolve,reject)=>{
      const fr = new FileReader();
      fr.onload = ()=>resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }
};
// Safe HTML helpers
Utils.escapeHtml = function(s){
  return String(s??"" )
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
};
Utils.escapeAttr = function(s){
  // per attributi (href, ecc.) basta una sanitizzazione base
  return Utils.escapeHtml(s).replace(/\s+/g," ").trim();
};


// --- Extra utils (v5.0) ---------------------------------------------------
// hash semplice per cache locale
Utils.hashString = function(str){
  str = String(str||"");
  let h = 2166136261;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
};

// Rimozione sfondo (auto chroma): prova a rendere trasparente lo sfondo uniforme (es. blu).
// Ritorna PNG dataURL. Funziona meglio con sfondi abbastanza uniformi.
Utils.blueToTransparent = async function(dataUrl){
  const img = new Image();
  img.decoding = "async";
  img.crossOrigin = "anonymous";
  const loaded = new Promise((resolve,reject)=>{
    img.onload = ()=>resolve();
    img.onerror = reject;
  });
  img.src = dataUrl;
  await loaded;

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently:true });
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  // Stima colore di sfondo dai 4 angoli
  const sample = (sx,sy,sw,sh)=>{
    let r=0,g=0,b=0,c=0;
    for(let y=sy;y<sy+sh;y++){
      for(let x=sx;x<sx+sw;x++){
        const i=(y*w+x)*4;
        const a=d[i+3];
        if(a<20) continue;
        r+=d[i]; g+=d[i+1]; b+=d[i+2]; c++;
      }
    }
    if(!c) return [0,0,0];
    return [r/c,g/c,b/c];
  };
  const boxW = Math.max(6, Math.floor(w*0.06));
  const boxH = Math.max(6, Math.floor(h*0.06));
  const c1 = sample(0,0,boxW,boxH);
  const c2 = sample(w-boxW,0,boxW,boxH);
  const c3 = sample(0,h-boxH,boxW,boxH);
  const c4 = sample(w-boxW,h-boxH,boxW,boxH);
  const bg = [
    (c1[0]+c2[0]+c3[0]+c4[0])/4,
    (c1[1]+c2[1]+c3[1]+c4[1])/4,
    (c1[2]+c2[2]+c3[2]+c4[2])/4,
  ];

  // Se lo sfondo stimato è "blu-ish" o comunque uniforme, applichiamo il cutout per similarità al bg.
  const bgBlueish = (bg[2] > bg[1] + 10) && (bg[2] > bg[0] + 10);

  const t0 = 42;   // sotto: totalmente trasparente
  const t1 = 78;   // sopra: lascia opaco
  for(let i=0;i<d.length;i+=4){
    const a=d[i+3];
    if(a===0) continue;
    const r=d[i], g=d[i+1], b=d[i+2];

    const dr=r-bg[0], dg=g-bg[1], db=b-bg[2];
    const dist = Math.sqrt(dr*dr + dg*dg + db*db);

    // euristica: per evitare di "bucare" i dettagli, chiediamo che il pixel sia coerente col blu
    const pxBlueish = (b > g + 8) && (b > r + 8);

    if(dist <= t0 && (!bgBlueish || pxBlueish)){
      d[i+3] = 0;
    }else if(dist < t1 && (!bgBlueish || pxBlueish)){
      // feather morbido
      const k = (dist - t0) / (t1 - t0); // 0..1
      d[i+3] = Math.round(a * Math.min(1, Math.max(0, k)));
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL("image/png");
};

const $ = (id)=>document.getElementById(id);

function roleOptions(selected){
  return ROLES.map(r=>`<option value="${r}" ${r===selected?"selected":""}>${r||"—"}</option>`).join("");
}

function avatarNode(player){
  const div=document.createElement("div");
  div.className="avatar avatar-initials";
  div.textContent = Utils.initials(player?.name || "");
  div.style.display="grid";
  div.style.placeItems="center";
  div.style.fontWeight="1000";
  return div;
}

// Per la lavagna: richiesta UI — mostra SOLO iniziali (niente foto)
function avatarNodeBoard(player){
  const div=document.createElement("div");
  div.className="avatar avatar-initials";
  div.textContent = Utils.initials(player.name);
  div.style.display="grid";
  div.style.placeItems="center";
  div.style.fontWeight="1000";
  return div;
}

// Rosa ufficiale ASD Calcio Sacile — stagione 2026/27
// Formato visualizzato: COGNOME Nome
const DEFAULT_ROSTER = [
  { id:"p01", name:"BATTAGLIA Riccardo", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p02", name:"BORSETTI Carlo", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p03", name:"BORTOLUZZI Filippo", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p04", name:"DA RE Edoardo", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p05", name:"DA ZAN Edoardo", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p06", name:"DE RE Leonardo", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p07", name:"DI LIBERTO Mirko", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p08", name:"DI MARCO Timoteo", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p09", name:"FILINGERI Daniel", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p10", name:"FRANCO Pietro Mario", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p11", name:"GORRICA Uesli", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p12", name:"KAMBERAJ Ronaldo", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p13", name:"KRAJA Kevin", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p14", name:"LA PIANA Andrea", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p15", name:"LOT Margherita", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p16", name:"MANCA Cristian", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p17", name:"MARCATO Lorenzo", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p18", name:"MELLA Gabriele", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p19", name:"PERIN Federico", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p20", name:"PERNIA Noha", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p21", name:"POPESCU Cristian Leonard", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p22", name:"RACHELE Gabriele", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p23", name:"ROLLO Gabriele", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p24", name:"SARO Federico", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p25", name:"SEKULJICA Marco", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p26", name:"SPRÒ Luca", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p27", name:"STEFANELLI Andrea", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p28", name:"TOFFOLON Leonardo", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p29", name:"ULIANA Alex", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p30", name:"ULIANA Oscar", role1:"", role2:"", number:"", photoDataUrl:"" },
  { id:"p31", name:"ZARDINI Christian", role1:"", role2:"", number:"", photoDataUrl:"" }
];
const DEFAULT_SETTINGS = {
  version: VERSION,
  teamName: "ASD Calcio Sacile",
  category: "Esordienti • 9 vs 9",
  misterName: "",
  logoDataUrl: "assets/sacile-logo.jpg",
  trainingDays: FIXED_TRAINING_DAYS
};

// --- Cloud sync (Supabase) -------------------------------------------------
// Per mantenere i dati "sempre online" serve un backend.
// Qui supportiamo Supabase (REST) in modo semplice e opzionale.
// Se non configurato, l'app continua a funzionare solo in locale.
const Cloud = (()=>{
  const CFG_KEY = "cloudConfig";
  let cfg = Storage.get(CFG_KEY, { supabaseUrl:"", supabaseAnonKey:"", teamId:"" });
  let timer = null;
  let lastError = "";

  function saveCfg(){ Storage.set(CFG_KEY, cfg); }
  function isEnabled(){
    return !!(cfg.supabaseUrl && cfg.supabaseAnonKey && cfg.teamId);
  }

  function setStatus(msg, isError=false){
    const el = document.getElementById("cloudStatus");
    if(!el) return;
    el.textContent = msg;
    el.classList.toggle("error", !!isError);
  }

  function exportAll(){
    const out = {
      version: VERSION,
      exportedAt: new Date().toISOString(),
      settings: Storage.get("settings", DEFAULT_SETTINGS),
      roster: Storage.get("roster", DEFAULT_ROSTER),
      matches: Storage.get("matches", []),
      exercises: Storage.get("exercises", []),
      whatsappTemplate: Storage.get("whatsappTemplate", null),
      whatsappLast: Storage.get("whatsappLast", {}),
      whatsappTarget: Storage.get("whatsappTarget", "https://wa.me/?text="),
      attendance: {}
    };
    // raccoglie tutte le presenze presenti in localStorage (att:YYYY-MM)
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      const prefix = STORAGE_PREFIX + "att:";
      if(!k || !k.startsWith(prefix)) continue;
      const monthKey = k.slice(prefix.length);
      out.attendance[monthKey] = Storage.get("att:" + monthKey, {});
    }
    return out;
  }

  function importAll(payload){
    if(!payload || typeof payload !== "object") throw new Error("Dati cloud non validi");
    if(payload.settings) Storage.set("settings", payload.settings);
    if(payload.roster) Storage.set("roster", payload.roster);
    if(payload.matches) Storage.set("matches", payload.matches);
    if(payload.exercises) Storage.set("exercises", payload.exercises);
    if(typeof payload.whatsappTemplate === "string") Storage.set("whatsappTemplate", payload.whatsappTemplate);
    if(payload.whatsappLast) Storage.set("whatsappLast", payload.whatsappLast);
    if(typeof payload.whatsappTarget === "string") Storage.set("whatsappTarget", payload.whatsappTarget);
    if(payload.attendance && typeof payload.attendance === "object"){
      Object.entries(payload.attendance).forEach(([mk,att])=>{
        Storage.set("att:"+mk, att);
      });
    }
  }

  async function upsert(){
    if(!isEnabled()) throw new Error("Cloud non configurato");
    const url = cfg.supabaseUrl.replace(/\/+$/,'');
    const endpoint = url + "/rest/v1/team_data";
    const body = [{ team_id: cfg.teamId, data: exportAll(), updated_at: new Date().toISOString() }];
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": cfg.supabaseAnonKey,
        "Authorization": "Bearer " + cfg.supabaseAnonKey,
        "Prefer": "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(body)
    });
    if(!res.ok){
      const t = await res.text().catch(()=>"");
      throw new Error(`Errore upload (${res.status}): ${t || res.statusText}`);
    }
  }

  async function download(){
    if(!isEnabled()) throw new Error("Cloud non configurato");
    const url = cfg.supabaseUrl.replace(/\/+$/,'');
    const endpoint = url + "/rest/v1/team_data?team_id=eq." + encodeURIComponent(cfg.teamId) + "&select=data";
    const res = await fetch(endpoint, {
      headers: {
        "apikey": cfg.supabaseAnonKey,
        "Authorization": "Bearer " + cfg.supabaseAnonKey
      }
    });
    if(!res.ok){
      const t = await res.text().catch(()=>"");
      throw new Error(`Errore download (${res.status}): ${t || res.statusText}`);
    }
    const arr = await res.json();
    const payload = arr?.[0]?.data;
    if(!payload) throw new Error("Nessun dato trovato nel cloud per questo teamId");
    importAll(payload);
  }

  function scheduleSync(){
    if(!isEnabled()) return;
    if(timer) clearTimeout(timer);
    timer = setTimeout(async ()=>{
      try{
        setStatus("Sincronizzazione…");
        await upsert();
        lastError = "";
        setStatus("Online ✅ (sincronizzato)");
      }catch(err){
        lastError = String(err?.message || err);
        setStatus("Errore cloud: " + lastError, true);
      }
    }, 1200);
  }

  function onLocalChange(key){
    // evita loop su settaggi cloud
    if(key===CFG_KEY) return;
    scheduleSync();
  }

  return {
    get cfg(){ return cfg; },
    setCfg(next){ cfg = { ...cfg, ...next }; saveCfg(); },
    isEnabled,
    onLocalChange,
    scheduleSync,
    upsert,
    download,
    setStatus
  };
})();

// collega il hook di Storage alla sync cloud
__onStorageSet = (key)=>Cloud.onLocalChange(key);

let settings = Storage.get("settings", DEFAULT_SETTINGS);
// aggiorna automaticamente la versione salvata (così si vede subito la nuova versione anche su installazioni esistenti)
if(!settings || typeof settings !== "object") settings = { ...DEFAULT_SETTINGS };
settings.trainingDays = [...FIXED_TRAINING_DAYS];
settings.category = "Esordienti • 9 vs 9";
settings.version = VERSION;
if(!settings.teamName) settings.teamName = "ASD Calcio Sacile";
if(!settings.logoDataUrl) settings.logoDataUrl = "assets/sacile-logo.jpg";
Storage.set("settings", settings);
// Migrazione rosa ufficiale: inserisce una sola volta la rosa ufficiale richiesta dal Mister.
// In questo modo l'aggiornamento da 4.0.0 non resta con la vecchia rosa vuota salvata in localStorage.
const ROSTER_SEED_501_KEY = "rosterSeed501Applied";
let roster = Storage.get("roster", null);
if(Storage.get(ROSTER_SEED_501_KEY, false) !== true){
  roster = DEFAULT_ROSTER.map(p=>({ ...p }));
  Storage.set("roster", roster);
  Storage.set(ROSTER_SEED_501_KEY, true);
}else if(!Array.isArray(roster)){
  roster = DEFAULT_ROSTER.map(p=>({ ...p }));
  Storage.set("roster", roster);
}
// Normalizza sempre gli id come stringhe (evita mismatch numero/stringa in selezioni, presenze, ecc.)
if(Array.isArray(roster)){
  roster = roster.map(p=>{
    const { photoDataUrl, ...clean } = p || {};
    return { ...clean, id: String(clean?.id ?? "") };
  });
  Storage.set("roster", roster);
}
let matches = Storage.get("matches", []);

// Esercizi (link salvati)
const EX_CATEGORIES = [
  "Tutti",
  "Riscaldamento",
  "Coordinazione",
  "Tecnica",
  "Passaggio",
  "Tiro",
  "1vs1",
  "Possesso",
  "Gioco a tema",
  "Partitella",
  "Portieri"
];

let exercises = Storage.get("exercises", []);
if(!Array.isArray(exercises)) exercises = [];

function setExercises(next){
  exercises = next;
  Storage.set("exercises", exercises);
}

function getAttendance(key){ return Storage.get("att:"+key, {}); }
function setAttendance(key, data){ Storage.set("att:"+key, data); }
function getRecordedAttendanceDays(key){ return Storage.get("attRecorded:"+key, []); }
function setRecordedAttendanceDays(key, days){ Storage.set("attRecorded:"+key, Array.from(new Set(days)).sort()); }
let rollcallDraft = { monthKey:"", iso:"", absent:new Set() };

function loadRollcallDraft(monthKey, iso){
  if(rollcallDraft.monthKey===monthKey && rollcallDraft.iso===iso) return;
  const recorded = getRecordedAttendanceDays(monthKey).includes(iso);
  const att = getAttendance(monthKey);
  const absent = new Set();
  if(recorded){
    for(const p of roster){ if(!(att[p.id] && att[p.id][iso]===true)) absent.add(p.id); }
  }
  rollcallDraft = { monthKey, iso, absent };
}

function renderRollcall(monthKey, iso){
  const list = document.getElementById("rollcallList");
  const dateEl = document.getElementById("rollcallDate");
  const countEl = document.getElementById("rollcallCount");
  const saveBtn = document.getElementById("btnSaveRollcall");
  if(!list || !dateEl || !countEl) return;
  list.innerHTML = "";
  if(!iso){
    dateEl.textContent = "Nessun allenamento selezionato";
    countEl.textContent = "—";
    if(saveBtn) saveBtn.disabled = true;
    return;
  }
  if(saveBtn) saveBtn.disabled = false;
  loadRollcallDraft(monthKey, iso);
  const d = new Date(iso+"T00:00:00");
  dateEl.textContent = d.toLocaleDateString("it-IT", {weekday:"long", day:"2-digit", month:"long", year:"numeric"});
  for(const p of roster){
    const absent = rollcallDraft.absent.has(p.id);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "rollcall-player" + (absent ? " absent" : " present");
    row.dataset.player = p.id;
    const left = document.createElement("span");
    left.className = "rollcall-player-main";
    left.appendChild(avatarNode(p));
    const nm = document.createElement("span"); nm.className="rollcall-player-name"; nm.textContent=p.name; left.appendChild(nm);
    const state = document.createElement("span");
    state.className = "rollcall-state";
    state.textContent = absent ? "ASSENTE" : "PRESENTE";
    row.appendChild(left); row.appendChild(state); list.appendChild(row);
  }
  const presentCount = Math.max(0, roster.length - rollcallDraft.absent.size);
  countEl.textContent = `${presentCount}/${roster.length} presenti`;
}


// Navigation
const pages = {
  presenze: $("page-presenze"),
  rosa: $("page-rosa"),
  partite: $("page-partite"),
};
pages.programmazione = $("page-programmazione");
// ESERCIZI
pages.esercizi = $("page-esercizi");
// La navigazione gestisce solo i tab con data-tab. Il pulsante "Lavagna" apre un overlay fullscreen.
document.querySelectorAll(".nav-item").forEach(btn=>{
  if(btn.dataset && btn.dataset.tab){
    btn.addEventListener("click", ()=> setTab(btn.dataset.tab));
  }
});

function setTab(tab){
  // Se cambio pagina, chiudi l'overlay lavagna (se aperto)
  if(isBoardOpen()) closeBoardOverlay();

  document.querySelectorAll(".nav-item").forEach(b=>{
    if(b.dataset && b.dataset.tab){
      b.classList.toggle("active", b.dataset.tab===tab);
    }
  });
  Object.entries(pages).forEach(([k,el])=> el && el.classList.toggle("hidden", k!==tab));
  if(tab==="presenze") renderAttendance();
  if(tab==="rosa") renderRoster();
  if(tab==="partite"){ renderMatchDropdowns(); renderMatches(); }
  if(tab==="programmazione"){ renderProgrammazione(); }
  if(tab==="esercizi"){ renderExercises(); }
}

// Pulsante "Lavagna": apre overlay a schermo pieno (PC + mobile)
const btnOpenBoard = document.getElementById("btnOpenBoard");
if(btnOpenBoard){
  btnOpenBoard.addEventListener("click", async ()=>{
    openBoardOverlay();
    // prova fullscreen nativo (se fallisce, l'overlay resta comunque a schermo intero)
    await enterBoardFullscreen();
  });
}

const btnBoardClose = document.getElementById("btnBoardClose");
if(btnBoardClose){
  btnBoardClose.addEventListener("click", ()=>{
    closeBoardOverlay();
  });
}

// Toggle rosa (solo mobile): comprime/espande la lista per dare più spazio al campo
// Toggle rosa: rimosso (lavagna pura)

// Branding + logo
function applyBrand(){
  $("teamTitle").textContent = settings.teamName || APP_NAME;
  const parts = [];
  parts.push("v" + (settings.version||VERSION));
  if(settings.category) parts.push(settings.category);
  if(settings.misterName) parts.push("Mister: " + settings.misterName);
  $("brandSub").textContent = parts.join(" • ");

  const logoEl = document.getElementById("teamLogo");
  if(logoEl){
    if(settings.logoDataUrl){
      logoEl.src = settings.logoDataUrl;
      logoEl.classList.remove("hidden");
    }else{
      logoEl.classList.add("hidden");
      logoEl.removeAttribute("src");
    }
  }
}
applyBrand();

function trainingDaysLabel(){
  return "Lun • Mer • Gio";
}
function updateTrainingDaysLabel(){
  const el=document.getElementById("attendanceDaysLabel");
  if(el) el.textContent = `Presenze (${trainingDaysLabel()})`;
}

// Month select
function buildMonthSelect(){
  const sel = $("monthSelect");
  sel.innerHTML = "";
  const now = new Date();
  const startYear = now.getFullYear();
  const years = Array.from({length: 6}, (_,i)=> startYear + i);
  for(const y of years){
    for(let m=1;m<=12;m++){
      const key = `${y}-${Utils.pad2(m)}`;
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = `${Utils.itMonth(m-1)} ${y}`;
      sel.appendChild(opt);
    }
  }
  const currentKey = Utils.monthKey(now);
  const stored = Storage.get("attSelectedMonth", currentKey);
  sel.value = Array.from(sel.options).some(o=>o.value===stored) ? stored : currentKey;
  sel.addEventListener("change", ()=>{
    Storage.set("attSelectedMonth", sel.value);
    renderAttendance();
  });
}
buildMonthSelect();

function trainingDatesForMonth(monthKey){
  const [yStr,mStr] = monthKey.split("-");
  const y=parseInt(yStr,10), m=parseInt(mStr,10);
  const out=[];
  const d=new Date(y, m-1, 1);
  while(d.getMonth()===m-1){
    const wd=d.getDay();
    if(FIXED_TRAINING_DAYS.includes(wd)){
      out.push({ iso: Utils.toISO(y,m,d.getDate()), day:d.getDate(), wd });
    }
    d.setDate(d.getDate()+1);
  }
  return out;
}

function updateNextCards(){
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = "";
  for(let i=0;i<12 && !next;i++){
    const d = new Date(today.getFullYear(), today.getMonth()+i, 1);
    const key = Utils.monthKey(d);
    next = trainingDatesForMonth(key).map(x=>x.iso)
      .find(iso=> new Date(iso+"T00:00:00") >= dayStart) || "";
  }
  $("nextTraining").textContent = next ? next.split("-").reverse().join("/") : "—";

  const future = matches
    .filter(m=>m.date)
    .map(m=>({ ...m, t:new Date(m.date+"T00:00:00") }))
    .filter(m=>m.t >= dayStart)
    .sort((a,b)=>a.t-b.t)[0];
  $("nextMatch").textContent = future ? future.date.split("-").reverse().join("/") : "—";
}

function renderAttendance(){
  const monthKey = $("monthSelect").value;
  const [yStr,mStr] = monthKey.split("-");
  $("monthTitle").textContent = `${Utils.itMonth(parseInt(mStr,10)-1)} ${yStr}`;

  const dates = trainingDatesForMonth(monthKey);
  const todayIso = Utils.isoDate(new Date());
  const att = getAttendance(monthKey);
  const recordedDays = getRecordedAttendanceDays(monthKey);
  for(const p of roster){ if(!att[p.id]) att[p.id] = {}; }

  // Giorno selezionato per azioni rapide (tutti presenti / pulisci)
  const selKey = "attSelectedDay:" + monthKey;
  let selectedIso = Storage.get(selKey, "");
  if(!selectedIso || !dates.some(d=>d.iso===selectedIso)){
    const todayIso = Utils.isoDate(new Date());
    selectedIso = dates.some(d=>d.iso===todayIso) ? todayIso : (dates[0]?.iso || "");
    Storage.set(selKey, selectedIso);
  }
  const dayLabel = document.getElementById("attDayLabel");
  if(dayLabel){
    if(selectedIso){
      const [yy,mm,dd] = selectedIso.split("-");
      dayLabel.textContent = `Giorno: ${dd}/${mm}/${yy}`;
    }else{
      dayLabel.textContent = "Giorno: —";
    }
  }

  // Layout richiesto:
  // - giorni di allenamento in ORIZZONTALE (intestazione)
  // - rosa (foto + nome) in VERTICALE (prima colonna)
  renderRollcall(monthKey, selectedIso);

  const wrap = $("attendanceTable");
  wrap.innerHTML = "";
  const table = document.createElement("table");
  table.className = "att-horizontal";

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  const th0 = document.createElement("th");
  th0.textContent = "Rosa";
  th0.className = "sticky-col";
  hr.appendChild(th0);

  for(const d of dates){
    const th = document.createElement("th");
    th.className = "day-head";
    th.dataset.date = d.iso;
    th.textContent = `${Utils.itWdShort(d.wd)} ${d.day}`;
    if(d.iso===todayIso) th.classList.add("today");
    if(d.iso===selectedIso) th.classList.add("selected");
    hr.appendChild(th);
  }

  
  const thPct = document.createElement("th");
  thPct.textContent = "%";
  thPct.className = "pct-head";
  hr.appendChild(thPct);

thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for(const p of roster){
    const tr = document.createElement("tr");
    tr.dataset.player = p.id;

    const thP = document.createElement("th");
    thP.className = "player-col sticky-col";
    const cell = document.createElement("div");
    cell.className = "player-cell";
    cell.appendChild(avatarNode(p));
    const nm = document.createElement("div");
    nm.className = "player-name";
    const _n = String(p.name||"").trim();
    const _parts = _n.split(/\s+/).filter(Boolean);
    if(_parts.length>1){
      const _last = _parts.pop();
      const _first = _parts.join(" ");
      nm.classList.add("two-line");
      nm.innerHTML = `<span class="fn">${_first}</span><span class="ln">${_last}</span>`;
    }else{
      nm.textContent = _n;
    }
    cell.appendChild(nm);
    thP.appendChild(cell);
    tr.appendChild(thP);

    let count = 0;
    for(const d of dates){
      const td = document.createElement("td");
      const dot = document.createElement("span");
      const recorded = recordedDays.includes(d.iso);
      const present = recorded && att[p.id][d.iso]===true;
      if(present) count++;
      dot.className = "dot" + (recorded ? (present ? " on" : " absent") : " pending");
      dot.dataset.date = d.iso;
      dot.dataset.player = p.id;
      dot.textContent = recorded ? (present ? "✓" : "×") : "·";
      dot.title = recorded ? (present ? "Presente" : "Assente") : "Appello non salvato";
      if(d.iso===todayIso) dot.classList.add("today");
      td.appendChild(dot);
      tr.appendChild(td);
    }

    const tdPct = document.createElement("td");
    const total = recordedDays.length;
    tdPct.className = "pct-cell";
    tdPct.textContent = total ? (String(Math.round((count/total)*100)) + "%") : "—";
    tr.appendChild(tdPct);

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);

  setAttendance(monthKey, att);
  updateNextCards();
}

// Selezione giorno (sempre evidenziato) cliccando sulla testata del giorno
$("attendanceTable").addEventListener("click", (e)=>{
  const day = e.target.closest(".day-head");
  if(day){
    const iso = day.dataset?.date;
    if(!iso) return;
    const monthKey = $("monthSelect").value;
    Storage.set("attSelectedDay:" + monthKey, iso);
    renderAttendance();
    return;
  }

  // Lo storico è solo consultazione: le presenze si registrano dall'Appello rapido.
  return;
});

// Details modal (solo visualizzazione)
const modalDetails = $("modalDetails");
let detailsPlayerId = null;

function refreshDetails(){
  const p = roster.find(x=>x.id===detailsPlayerId);
  if(!p) return;

  $("dName").textContent = p.name;
  $("dId").textContent = ""; $("dId").style.display="none";

  const dAv = $("dAvatar");
  dAv.innerHTML = "";
  const initials = document.createElement("div");
  initials.className = "detail-initials";
  initials.textContent = Utils.initials(p.name);
  dAv.appendChild(initials);

  const role = [p.role1, p.role2].filter(Boolean).join(" / ");
  $("dRole").textContent = role || "—";
  $("dNumber").textContent = (p.number && String(p.number).trim()!=="") ? String(p.number) : "—";
}
function openDetails(playerId){
  detailsPlayerId = playerId;
  refreshDetails();
  modalDetails.classList.remove("hidden");
}
function closeDetails(){
  modalDetails.classList.add("hidden");
  detailsPlayerId = null;
}
$("btnDetailsClose").addEventListener("click", closeDetails);
modalDetails.addEventListener("click",(e)=>{ if(e.target===modalDetails) closeDetails(); });

// Roster render + roles + number input
function renderRoster(){
  try{ renderWaDropdowns && renderWaDropdowns(); }catch(_){ }

  const wrap = $("rosterList");
  wrap.innerHTML = "";

  for(const p of roster){
    const row = document.createElement("div");
    row.className = "roster-row";

    const identity = document.createElement("div");
    identity.className = "roster-identity";

    const initials = document.createElement("div");
    initials.className = "roster-initials";
    initials.textContent = Utils.initials(p.name);

    const name = document.createElement("div");
    name.className = "roster-name";
    name.textContent = p.name || "—";
    name.title = "Clicca per vedere i dettagli";
    name.addEventListener("click", ()=> openDetails(p.id));

    identity.appendChild(initials);
    identity.appendChild(name);

    const role1 = document.createElement("select");
    role1.className = "roster-select";
    role1.setAttribute("aria-label","Ruolo principale");
    role1.innerHTML = roleOptions(p.role1||"");
    role1.addEventListener("change", ()=>{
      p.role1 = role1.value;
      Storage.set("roster", roster);
      if(detailsPlayerId===p.id) refreshDetails();
      renderMatchDropdowns();
      renderBoardRoster();
    });

    const role2 = document.createElement("select");
    role2.className = "roster-select";
    role2.setAttribute("aria-label","Secondo ruolo");
    role2.innerHTML = roleOptions(p.role2||"");
    role2.addEventListener("change", ()=>{
      p.role2 = role2.value;
      Storage.set("roster", roster);
      if(detailsPlayerId===p.id) refreshDetails();
      renderMatchDropdowns();
      renderBoardRoster();
    });

    const number = document.createElement("select");
    number.className = "roster-number";
    number.setAttribute("aria-label","Numero maglia");
    number.innerHTML = [`<option value="">—</option>`].concat(
      Array.from({length:99},(_,i)=>{
        const v=String(i+1);
        return `<option value="${v}" ${String(p.number||"")===v?"selected":""}>${v}</option>`;
      })
    ).join("");
    number.addEventListener("change", ()=>{
      p.number = number.value;
      Storage.set("roster", roster);
      if(detailsPlayerId===p.id) refreshDetails();
      updateBoardTokenNumbers(p.id);
      renderBoardRoster();
    });

    const del = document.createElement("button");
    del.className = "btn danger roster-remove";
    del.type = "button";
    del.textContent = "Rimuovi";
    del.addEventListener("click", ()=>{
      if(!confirm(`Rimuovere ${p.name}?`)) return;
      roster = roster.filter(x=>x.id!==p.id);
      Storage.set("roster", roster);
      if(detailsPlayerId===p.id) closeDetails();

      // Presenze, partite e lavagna leggono la stessa rosa:
      // il giocatore scompare immediatamente da tutte le viste.
      renderRoster();
      renderAttendance();
      renderMatchDropdowns();
      renderBoardRoster();
    });

    const c1 = document.createElement("div");
    c1.className = "roster-cell roster-player-cell";
    c1.appendChild(identity);

    const c2 = document.createElement("div");
    c2.className = "roster-cell";
    c2.appendChild(role1);

    const c3 = document.createElement("div");
    c3.className = "roster-cell";
    c3.appendChild(role2);

    const c4 = document.createElement("div");
    c4.className = "roster-cell";
    c4.appendChild(number);

    const c5 = document.createElement("div");
    c5.className = "roster-cell roster-actions-cell";
    c5.appendChild(del);

    row.append(c1,c2,c3,c4,c5);
    wrap.appendChild(row);
  }
}

// Add player modal
const modalPlayer = $("modalPlayer");
$("btnAddPlayer").addEventListener("click", ()=>{
  $("pName").value="";
  modalPlayer.classList.remove("hidden");
});
$("btnPlayerCancel").addEventListener("click", ()=> modalPlayer.classList.add("hidden"));
modalPlayer.addEventListener("click",(e)=>{ if(e.target===modalPlayer) modalPlayer.classList.add("hidden"); });

$("btnPlayerSave").addEventListener("click", ()=>{
  const name = $("pName").value.trim();
  if(!name){ alert("Inserisci Nome e Cognome."); return; }
  const p = { id: String(Date.now()), name, role1:"", role2:"", number:"" };
  roster.push(p);
  Storage.set("roster", roster);
  modalPlayer.classList.add("hidden");

  // Aggiornamento immediato di tutte le aree che dipendono dalla rosa.
  renderRoster();
  renderAttendance();
  renderMatchDropdowns();
  renderBoardRoster();
});


function updateViewportVars(){
  try{
    const h = (window.visualViewport && window.visualViewport.height) ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty("--vvh", h + "px");
  }catch(_){}
}
updateViewportVars();
window.addEventListener("resize", ()=>{ setTimeout(updateViewportVars, 50); });
window.addEventListener("orientationchange", ()=>{ setTimeout(updateViewportVars, 120); });
if(window.visualViewport){
  window.visualViewport.addEventListener("resize", ()=>{ setTimeout(updateViewportVars, 50); });
}


// Tattica (Lavagna 9 vs 9)
// Progettata prima di tutto per touch/mobile, ma pienamente utilizzabile anche da PC.

const pitch = $("pitch");
const tokens = $("tokens");
const ink = $("ink");
const ctx = ink.getContext("2d");

let tool = "none"; // none | pen | eraser
let drawing = false;
let boardInkColor = "#D0A057";
let activeStroke = null;
let inkStrokes = Storage.get("boardInk", []);
if(!Array.isArray(inkStrokes)) inkStrokes = [];


const HOME_FORMATION_9 = [
  [0.50,0.82], // P - portiere
  [0.24,0.67],[0.50,0.69],[0.76,0.67], // 3 difensori
  [0.34,0.51],[0.66,0.51], // 2 centrocampisti
  [0.22,0.34],[0.50,0.30],[0.78,0.34] // 3 attaccanti
];

function isPresentMode(){ return document.body.classList.contains("present-mode"); }
function isBoardOpen(){
  const o = document.getElementById("boardOverlay");
  return !!o && !o.classList.contains("hidden");
}
function enterPresentMode(){
  updateViewportVars();
  document.body.classList.add("present-mode");
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}
function exitPresentMode(){
  document.body.classList.remove("present-mode");
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}
function isMobileBoard(){ return window.matchMedia && window.matchMedia("(max-width: 860px)").matches; }
function setRosterCollapsed(){ /* compatibilità */ }

function resizeInk(){
  if(!pitch || !ink) return;
  const w=Math.max(1,pitch.clientWidth), h=Math.max(1,pitch.clientHeight);
  const dpr=Math.min(3, window.devicePixelRatio || 1);
  ink.width=Math.floor(w*dpr); ink.height=Math.floor(h*dpr);
  ink.style.width=w+"px"; ink.style.height=h+"px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.lineCap="round"; ctx.lineJoin="round";
  redrawInk();
}
function drawStoredStroke(stroke){
  if(!stroke || !Array.isArray(stroke.points) || stroke.points.length<1) return;
  const w=ink.clientWidth||1, h=ink.clientHeight||1;
  ctx.save();
  ctx.globalCompositeOperation = stroke.tool==="eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.color || "#D0A057";
  ctx.lineWidth = stroke.tool==="eraser" ? 24 : 4;
  ctx.beginPath();
  stroke.points.forEach((p,i)=>{
    const x=p.x*w, y=p.y*h;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  if(stroke.points.length===1){
    const p=stroke.points[0]; ctx.lineTo(p.x*w+.01,p.y*h+.01);
  }
  ctx.stroke(); ctx.restore();
}
function redrawInk(){
  if(!ink) return;
  ctx.clearRect(0,0,ink.clientWidth||0,ink.clientHeight||0);
  inkStrokes.forEach(drawStoredStroke);
}
function safeBoardResize(){
  try{ updateViewportVars(); }catch(_){}
  try{ resizeInk(); }catch(_){}
}
document.addEventListener("fullscreenchange", ()=>{ setTimeout(safeBoardResize,80); setTimeout(safeBoardResize,260); });
window.addEventListener("resize", ()=>setTimeout(safeBoardResize,60));
window.addEventListener("orientationchange", ()=>{ setTimeout(safeBoardResize,120); setTimeout(safeBoardResize,420); });
if(window.visualViewport) window.visualViewport.addEventListener("resize", ()=>setTimeout(safeBoardResize,60));

async function enterBoardFullscreen(){
  enterPresentMode();
  setTimeout(safeBoardResize,80); setTimeout(safeBoardResize,260);
}
function openBoardOverlay(){
  const o=document.getElementById("boardOverlay"); if(!o) return;
  o.classList.remove("hidden"); o.setAttribute("aria-hidden","false");
  document.body.classList.add("no-scroll");
  ensureBoardTokens(); setTool("none");
  enterBoardFullscreen(); setTimeout(safeBoardResize,80);
}
async function closeBoardOverlay(){
  const o=document.getElementById("boardOverlay"); if(!o) return;
  try{ if(document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen(); }catch(_){}
  o.classList.add("hidden"); o.setAttribute("aria-hidden","true");
  document.body.classList.remove("no-scroll"); setTool("none"); exitPresentMode();
}

function setTool(next){
  tool=next||"none";
  document.getElementById("btnPen")?.classList.toggle("active",tool==="pen");
  document.getElementById("btnEraser")?.classList.toggle("active",tool==="eraser");
  tokens?.classList.toggle("drag-disabled", tool==="pen" || tool==="eraser");
  const hint=document.getElementById("boardHint");
  if(hint) hint.textContent = tool==="pen" ? "Disegna sul campo • tocca Penna per tornare alle pedine" : tool==="eraser" ? "Passa il dito sulle linee da cancellare" : "Trascina le pedine • Penna per disegnare";
}
document.getElementById("btnPen")?.addEventListener("click",()=>setTool(tool==="pen"?"none":"pen"));
document.getElementById("btnEraser")?.addEventListener("click",()=>setTool(tool==="eraser"?"none":"eraser"));
document.querySelectorAll("[data-board-color]").forEach(btn=>btn.addEventListener("click",()=>{
  boardInkColor=btn.dataset.boardColor||"#D0A057";
  document.querySelectorAll("[data-board-color]").forEach(x=>x.classList.toggle("active",x===btn));
  if(tool!=="pen") setTool("pen");
}));
document.getElementById("btnUndoBoard")?.addEventListener("click",()=>{
  if(inkStrokes.length){ inkStrokes.pop(); Storage.set("boardInk",inkStrokes); redrawInk(); }
});
document.getElementById("btnClearBoard")?.addEventListener("click",()=>{
  inkStrokes=[]; Storage.set("boardInk",inkStrokes); redrawInk();
});

function defaultBoardTokenState(){
  const state={};
  HOME_FORMATION_9.forEach((p,i)=>state[`h${i+1}`]={x:p[0],y:p[1]});
  return state;
}
function getBoardTokenState(){
  const saved=Storage.get("boardTokens",null);
  return saved && typeof saved==="object" ? saved : defaultBoardTokenState();
}
function saveTokenPosition(el){
  const state=getBoardTokenState();
  state[el.dataset.key]={x:+el.dataset.nx,y:+el.dataset.ny};
  Storage.set("boardTokens",state);
}
function placeToken(el,nx,ny){
  const marginX=Math.min(.08, 30/Math.max(1,pitch.clientWidth));
  const marginY=Math.min(.08, 30/Math.max(1,pitch.clientHeight));
  nx=Math.max(marginX,Math.min(1-marginX,+nx||0));
  ny=Math.max(marginY,Math.min(1-marginY,+ny||0));
  el.dataset.nx=String(nx); el.dataset.ny=String(ny);
  el.style.left=(nx*100)+"%"; el.style.top=(ny*100)+"%";
}
function createBoardToken(key,label,pos){
  const el=document.createElement("div");
  el.className="token home";
  el.dataset.key=key;
  el.setAttribute("role","button");
  el.setAttribute("tabindex","0");
  el.setAttribute("aria-label",`Sacile ${label}`);
  el.innerHTML=`<span>${label}</span>`;
  placeToken(el,pos.x,pos.y);
  return el;
}
function ensureBoardTokens(){
  if(!tokens) return;
  const state=getBoardTokenState();
  tokens.innerHTML="";
  // Esordienti 9v9: SOLO la nostra squadra, 1 portiere + 8 giocatori di movimento.
  for(let i=1;i<=9;i++){
    const label = i===1 ? "P" : String(i);
    const el=createBoardToken(`h${i}`,label,state[`h${i}`]||{x:.5,y:.5});
    if(i===1) el.classList.add("keeper");
    tokens.appendChild(el);
  }
}
document.getElementById("btnResetBoard")?.addEventListener("click",()=>{
  Storage.set("boardTokens",defaultBoardTokenState());
  ensureBoardTokens();
});

// Drag robusto su PC e mobile: il movimento viene seguito a livello window,
// quindi la pedina continua a muoversi anche quando il dito/mouse esce dal suo cerchio.
let draggedToken=null;
let draggedPointerId=null;
function boardPointerDown(e){
  if(tool!=="none") return;
  const tokenEl=e.target.closest?.(".token.home");
  if(!tokenEl || !tokens?.contains(tokenEl)) return;
  draggedToken=tokenEl;
  draggedPointerId=e.pointerId;
  tokenEl.classList.add("dragging");
  try{ tokenEl.setPointerCapture?.(e.pointerId); }catch(_){}
  e.preventDefault();
  e.stopPropagation();
}
function boardPointerMove(e){
  if(!draggedToken || (draggedPointerId!=null && e.pointerId!==draggedPointerId)) return;
  const r=pitch.getBoundingClientRect();
  if(!r.width || !r.height) return;
  placeToken(draggedToken,(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);
  e.preventDefault();
}
function boardPointerUp(e){
  if(!draggedToken || (draggedPointerId!=null && e.pointerId!==draggedPointerId)) return;
  saveTokenPosition(draggedToken);
  draggedToken.classList.remove("dragging");
  try{ draggedToken.releasePointerCapture?.(draggedPointerId); }catch(_){}
  draggedToken=null;
  draggedPointerId=null;
}
tokens?.addEventListener("pointerdown",boardPointerDown,{passive:false});
window.addEventListener("pointermove",boardPointerMove,{passive:false});
window.addEventListener("pointerup",boardPointerUp,{passive:true});
window.addEventListener("pointercancel",boardPointerUp,{passive:true});

function inkPoint(e){
  const r=ink.getBoundingClientRect();
  return {x:(e.clientX-r.left)/Math.max(1,r.width), y:(e.clientY-r.top)/Math.max(1,r.height)};
}
function startInk(e){
  if(!(tool==="pen" || tool==="eraser")) return;
  drawing=true;
  activeStroke={tool,color:boardInkColor,points:[inkPoint(e)]};
  try{ ink.setPointerCapture(e.pointerId); }catch(_){}
  redrawInk(); drawStoredStroke(activeStroke); e.preventDefault();
}
function moveInk(e){
  if(!drawing || !activeStroke) return;
  const p=inkPoint(e), last=activeStroke.points[activeStroke.points.length-1];
  if(last && Math.hypot(p.x-last.x,p.y-last.y)<.002) return;
  activeStroke.points.push(p); redrawInk(); drawStoredStroke(activeStroke); e.preventDefault();
}
function endInk(e){
  if(!drawing || !activeStroke) return;
  drawing=false;
  inkStrokes.push(activeStroke);
  if(inkStrokes.length>120) inkStrokes=inkStrokes.slice(-120);
  Storage.set("boardInk",inkStrokes); activeStroke=null; redrawInk();
  try{ ink.releasePointerCapture(e.pointerId); }catch(_){}
}
ink.addEventListener("pointerdown",startInk,{passive:false});
ink.addEventListener("pointermove",moveInk,{passive:false});
ink.addEventListener("pointerup",endInk,{passive:true});
ink.addEventListener("pointercancel",endInk,{passive:true});

function updateBoardTokenNumbers(){ /* compatibilità con vecchia rosa: pedine 9v9 numerate 1-9 */ }
function renderBoardRoster(){
  // La lavagna 3.0.4 usa solo 1 portiere + 8 giocatori di movimento del Sacile.
  if(isBoardOpen()) ensureBoardTokens();
}

// Partite
function renderMatchDropdowns(){
  const cap=$("mCaptain"), vice=$("mVice");
  cap.innerHTML=""; vice.innerHTML="";
  for(const p of roster){
    const o1=document.createElement("option"); o1.value=p.id; o1.textContent=p.name;
    const o2=document.createElement("option"); o2.value=p.id; o2.textContent=p.name;
    cap.appendChild(o1); vice.appendChild(o2);
  }
}

// WhatsApp — Convocazioni (Mister Fab 2.0)
const DEFAULT_WA_TEMPLATE = `Buongiorno a tutti
vi giro le convocazioni per la partita del ________
contro______
ritrovo direttamente al campo di_______
alle ore______
Cap. _________
V. Cap. _______
eventuali assenze vanno comunicate in privato

obbligatorio:
tuta di rappresentanza 
parastinchi
grazie e buona giornata`;

let __waInit = false;

function waNormalizeIdArray(x){
  if(Array.isArray(x)) return x.filter(v=>v!==null && v!==undefined && String(v).trim()).map(v=>String(v).trim()).slice(0,2);
  if(typeof x === "string" && x.trim()) return [x.trim()];
  if(typeof x === "number") return [String(x)];
  return [];
}

function waPlayerName(id){
  const sid = String(id ?? "");
  return roster.find(p=>String(p.id)===sid)?.name || "";
}

function waRenderChips(containerId, ids, labelEmpty){
  const el = $(containerId);
  if(!el) return;
  el.innerHTML = "";
  const arr = waNormalizeIdArray(ids);
  if(arr.length===0){
    const d=document.createElement("div");
    d.className="muted";
    d.style.opacity=".9";
    d.textContent = labelEmpty || "Seleziona dalla lista";
    el.appendChild(d);
    return;
  }
  for(const id of arr){
    const chip=document.createElement("span");
    chip.className="chip";
    chip.innerHTML = `${Utils.escapeHtml(waPlayerName(id) || "—")} <button class="x" type="button" data-x="${Utils.escapeAttr(id)}" aria-label="Rimuovi">×</button>`;
    el.appendChild(chip);
  }
}

function waGetTargetBase(){
  const t = Storage.get("whatsappTarget", "https://wa.me/?text=");
  return (typeof t === "string" && t.trim()) ? t.trim() : "https://wa.me/?text=";
}

function waBuildTargetUrl(text){
  const base = waGetTargetBase();
  const enc = encodeURIComponent(text || "");

  // 1) placeholder {text}
  if(base.includes("{text}")) return base.replaceAll("{text}", enc);

  // 2) se termina con text=, append
  if(/[?&]text=$/i.test(base)) return base + enc;

  // 3) se contiene già text=..., sostituisco
  try{
    const u = new URL(base);
    if(u.searchParams.has("text")){
      u.searchParams.set("text", text || "");
      return u.toString();
    }
  }catch(_){ /* no-op */ }

  // 4) fallback: aggiungo ?text=
  const sep = base.includes("?") ? "&" : "?";
  return base + sep + "text=" + enc;
}

function waRenderConvocatiList(selectedIds, captainIds, viceIds){
  const wrap = $("waConvocati");
  if(!wrap) return;
  wrap.innerHTML = "";

  const sel = new Set((Array.isArray(selectedIds) ? selectedIds : []).map(x=>String(x)));
  const sorted = [...roster].sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  for(const p of sorted){
    const pid = String(p.id);
    const row = document.createElement("label");
    row.className = "wa-player" + (sel.has(pid) ? " is-checked" : "");
    row.innerHTML = `
      <input type="checkbox" class="wa-cb" value="${Utils.escapeAttr(pid)}" ${sel.has(pid)?"checked":""} />
      <span class="wa-name">${Utils.escapeHtml(p.name||"—")}</span>
      <button class="wa-role" type="button" data-role="cap" data-id="${Utils.escapeAttr(pid)}" aria-label="Imposta Capitano">C</button>
      <button class="wa-role" type="button" data-role="vice" data-id="${Utils.escapeAttr(pid)}" aria-label="Imposta Vice">V</button>
    `;

    const capBtn = row.querySelector('[data-role="cap"]');
    const viceBtn = row.querySelector('[data-role="vice"]');
    if(waNormalizeIdArray(captainIds).includes(pid)) capBtn.classList.add("active");
    if(waNormalizeIdArray(viceIds).includes(pid)) viceBtn.classList.add("active");

    wrap.appendChild(row);
  }
}

function waConvocatiText(ids){
  const arr = (Array.isArray(ids) ? ids : []).filter(Boolean);
  const names = arr.map(id=>waPlayerName(id)).filter(Boolean);
  if(names.length===0) return "";
  return `\n\nConvocati (${names.length}):\n` + names.map(n=>`- ${n}`).join("\n");
}

function waFormatDate(iso){
  if(!iso) return "";
  const parts = iso.split("-");
  if(parts.length!==3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function waFillTemplateSequential(tpl, values){
  let i=0;
  return String(tpl||"").replace(/_{2,}/g, (m)=>{
    if(i>=values.length) return m;
    const v = (values[i++] ?? "").toString().trim();
    return v ? v : m;
  });
}

function waGetNextMatch(){
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const future = matches
    .filter(m=>m.date)
    .map(m=>({ ...m, t:new Date(m.date+"T00:00:00") }))
    .filter(m=>m.t >= base)
    .sort((a,b)=>a.t-b.t)[0];
  return future || null;
}


function waPulseButton(btnId, label){
  const b = $(btnId);
  if(!b) return;
  const old = b.textContent;
  b.textContent = label;
  b.disabled = true;
  setTimeout(()=>{ b.textContent = old; b.disabled = false; }, 900);
}

function initWhatsAppConvocation(){
  if(__waInit) return;
  __waInit = true;

  const tplEl = $("wTemplate");
  const prevEl = $("waPreview");
  if(!tplEl || !prevEl) return;

  const savedTpl = Storage.get("whatsappTemplate", null);
  tplEl.value = (typeof savedTpl==="string" && savedTpl.trim()) ? savedTpl : DEFAULT_WA_TEMPLATE;

  // load last values (optional)
  const last = Storage.get("whatsappLast", {}) || {};
  if($("wDate")) $("wDate").value = last.date || "";
  if($("wOpponent")) $("wOpponent").value = last.opponent || "";
  if($("wField")) $("wField").value = last.field || "";
  if($("wTime")) $("wTime").value = last.time || "";

  // gruppo fisso (target)
  if($("wTarget")) $("wTarget").value = Storage.get("whatsappTarget", "https://wa.me/?text=") || "https://wa.me/?text=";

  // ruoli (max 2 + compatibilità con vecchie chiavi)
  let captainIds = waNormalizeIdArray(last.captainIds ?? last.captain);
  let viceIds = waNormalizeIdArray(last.viceIds ?? last.vice);

  // lista convocati
  const convocati = Array.isArray(last.convocati) ? last.convocati : [];
  waRenderConvocatiList(convocati, captainIds, viceIds);
  waRenderChips("wCaptainChips", captainIds, "Tocca C su 2 giocatori");
  waRenderChips("wViceChips", viceIds, "Tocca V su 2 giocatori");

  const recompute = ()=>{
    // leggi convocati (se la lista esiste)
    const checked = Array.from(document.querySelectorAll("#waConvocati .wa-cb:checked")).map(x=>x.value);

    // se i ruoli non sono nei convocati, rimuovili
    captainIds = waNormalizeIdArray(captainIds).filter(id=>checked.includes(id));
    viceIds = waNormalizeIdArray(viceIds).filter(id=>checked.includes(id));

    const values = [
      waFormatDate($("wDate")?.value || ""),
      ($("wOpponent")?.value || "").trim(),
      ($("wField")?.value || "").trim(),
      ($("wTime")?.value || "").trim(),
      waNormalizeIdArray(captainIds).map(id=>waPlayerName(id)).filter(Boolean).join(" / "),
      waNormalizeIdArray(viceIds).map(id=>waPlayerName(id)).filter(Boolean).join(" / "),
    ];
    const outBase = waFillTemplateSequential(tplEl.value, values);
    const out = outBase + waConvocatiText(checked);
    prevEl.textContent = out;

    // persist current values (no dati vecchi toccati: solo nuove chiavi)
    Storage.set("whatsappTemplate", tplEl.value);
    Storage.set("whatsappLast", {
      date: $("wDate")?.value || "",
      opponent: $("wOpponent")?.value || "",
      field: $("wField")?.value || "",
      time: $("wTime")?.value || "",
      captainIds: waNormalizeIdArray(captainIds),
      viceIds: waNormalizeIdArray(viceIds),
      convocati: checked
    });

    // persisti target (gruppo fisso)
    if($("wTarget")) Storage.set("whatsappTarget", $("wTarget").value || "https://wa.me/?text=");

    // aggiorna UI lista convocati (evidenzia C/V) + chips
    waRenderConvocatiList(checked, captainIds, viceIds);
    waRenderChips("wCaptainChips", captainIds, "Tocca C su 2 giocatori");
    waRenderChips("wViceChips", viceIds, "Tocca V su 2 giocatori");
    return out;
  };

  // events
  ["input","change"].forEach(ev=>{
    $("wDate")?.addEventListener(ev, recompute);
    $("wOpponent")?.addEventListener(ev, recompute);
    $("wField")?.addEventListener(ev, recompute);
    $("wTime")?.addEventListener(ev, recompute);
    $("wTarget")?.addEventListener(ev, recompute);
    tplEl.addEventListener(ev, recompute);
  });

  // checkbox convocati: aggiornamento immediato
  $("waConvocati")?.addEventListener("change", (e)=>{
    if(e.target && e.target.classList && e.target.classList.contains("wa-cb")) recompute();
  });

  // delega click per impostare C/V dalla lista convocati
  $("waConvocati")?.addEventListener("click", (e)=>{
    const btn = e.target?.closest?.(".wa-role");
    if(!btn) return;
    e.preventDefault();
    const id = btn.getAttribute("data-id");
    const role = btn.getAttribute("data-role");
    if(!id || !role) return;

    // assicura che sia convocato
    const wrap = $("waConvocati");
    const safeId = (window.CSS && CSS.escape) ? CSS.escape(id) : id.replace(/"/g,'\\"');
    const cb = wrap?.querySelector(`.wa-cb[value="${safeId}"]`);
    if(cb) cb.checked = true;

    const toggleWithLimit2 = (arr, idToToggle)=>{
      arr = waNormalizeIdArray(arr);
      if(arr.includes(idToToggle)) return arr.filter(x=>x!==idToToggle);
      if(arr.length>=2) arr = arr.slice(1); // rimuovi il più vecchio
      arr.push(idToToggle);
      return arr;
    };

    if(role === "cap"){
      captainIds = toggleWithLimit2(captainIds, id);
      // evita doppio ruolo
      viceIds = waNormalizeIdArray(viceIds).filter(x=>!captainIds.includes(x));
    }
    if(role === "vice"){
      viceIds = toggleWithLimit2(viceIds, id);
      captainIds = waNormalizeIdArray(captainIds).filter(x=>!viceIds.includes(x));
    }
    recompute();
  });

  // rimozione rapida dai chips
  $("wCaptainChips")?.addEventListener("click", (e)=>{
    const id = e.target?.getAttribute?.("data-x");
    if(!id) return;
    captainIds = waNormalizeIdArray(captainIds).filter(x=>x!==id);
    recompute();
  });
  $("wViceChips")?.addEventListener("click", (e)=>{
    const id = e.target?.getAttribute?.("data-x");
    if(!id) return;
    viceIds = waNormalizeIdArray(viceIds).filter(x=>x!==id);
    recompute();
  });

  $("btnWaFillNext")?.addEventListener("click", ()=>{
    const nm = waGetNextMatch();
    if(nm){
      $("wDate").value = nm.date || "";
      $("wOpponent").value = nm.opponent || "";
      if(nm.captain) captainIds = waNormalizeIdArray([nm.captain]);
      if(nm.vice) viceIds = waNormalizeIdArray([nm.vice]);
      // se partita fuori casa, suggerisci campo avversario (lasciamo vuoto se non presente)
    }
    recompute();
  });

  $("btnWaCopy")?.addEventListener("click", async ()=>{
    const text = recompute();
    try{
      await navigator.clipboard.writeText(text);
      waPulseButton("btnWaCopy","Copiato ✔️");
    }catch(_){
      // fallback: seleziona e copia
      const ta=document.createElement("textarea");
      ta.value=text; ta.style.position="fixed"; ta.style.left="-9999px";
      document.body.appendChild(ta); ta.select();
      try{ document.execCommand("copy"); waPulseButton("btnWaCopy","Copiato ✔️"); }catch(e){ waPulseButton("btnWaCopy","Copia non riuscita"); }
      ta.remove();
    }
  });

  $("btnWaOpen")?.addEventListener("click", ()=>{
    const text = recompute();
    const url = waBuildTargetUrl(text);
    window.open(url, "_blank", "noopener");
  });

  // first preview
  recompute();
}


let editingMatchId = null;

function renderMatches(){
  const wrap=$("matchesList");
  wrap.innerHTML="";
  if(matches.length===0){
    wrap.innerHTML = '<div class="hint">Nessuna partita salvata.</div>';
    updateNextCards();
    return;
  }
  const sorted=[...matches].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  for(const m of sorted){
    const el=document.createElement("div");
    el.className="item";
    const capName=roster.find(p=>p.id===m.captain)?.name||"—";
    const viceName=roster.find(p=>p.id===m.vice)?.name||"—";
    const date=m.date ? m.date.split("-").reverse().join("/") : "—";
    const score=[m.q1,m.q2,m.q3,m.q4].filter(Boolean).join(" | ") || "—";
    el.innerHTML = `
      <div>
        <div class="t">${Utils.escapeHtml(m.opponent || "Avversario")}</div>
        <div class="s">${Utils.escapeHtml(date)} • ${Utils.escapeHtml(score)}</div>
        <div class="s">Capitano: ${Utils.escapeHtml(capName)} • Vice: ${Utils.escapeHtml(viceName)}</div>
      </div>
      <div class="a">
        <button class="small" data-act="edit" type="button">Modifica</button>
        <button class="small danger" data-act="del" type="button">Elimina</button>
      </div>
    `;
    el.querySelector('[data-act="del"]').addEventListener("click", ()=>{
      if(!confirm("Eliminare questa partita?")) return;
      matches = matches.filter(x=>x.id!==m.id);
      Storage.set("matches", matches);
      renderMatches();
    });
    el.querySelector('[data-act="edit"]').addEventListener("click", ()=>{
      $("mDate").value = m.date || "";
      $("mOpponent").value = m.opponent || "";
      $("mQ1").value = m.q1 || "";
      $("mQ2").value = m.q2 || "";
      $("mQ3").value = m.q3 || "";
      $("mQ4").value = m.q4 || "";
      $("mCaptain").value = m.captain || roster[0]?.id || "";
      $("mVice").value = m.vice || roster[0]?.id || "";
      editingMatchId = m.id;
      $("btnAddMatch").textContent = "Aggiorna partita";
      window.scrollTo({top:0, behavior:"smooth"});
    });
    wrap.appendChild(el);
  }
  updateNextCards();
}
$("btnAddMatch").addEventListener("click", ()=>{
  const m={
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random()),
    date: $("mDate").value,
    opponent: $("mOpponent").value.trim(),
    q1: $("mQ1").value.trim(),
    q2: $("mQ2").value.trim(),
    q3: $("mQ3").value.trim(),
    q4: $("mQ4").value.trim(),
    captain: $("mCaptain").value,
    vice: $("mVice").value,
  };
  if(editingMatchId){
    m.id = editingMatchId;
    matches = matches.map(x=>x.id===editingMatchId ? m : x);
    editingMatchId = null;
    $("btnAddMatch").textContent = "Salva partita";
  }else{
    matches.push(m);
  }
  Storage.set("matches", matches);
  renderMatches();
  $("mDate").value=""; $("mOpponent").value=""; $("mQ1").value=""; $("mQ2").value=""; $("mQ3").value=""; $("mQ4").value="";
});
$("btnClearMatchForm").addEventListener("click", ()=>{
  $("mDate").value=""; $("mOpponent").value=""; $("mQ1").value=""; $("mQ2").value=""; $("mQ3").value=""; $("mQ4").value="";
  editingMatchId = null;
  $("btnAddMatch").textContent = "Salva partita";
});

// Print helpers
function setPrintHeader(contextLabel){
  const team = document.getElementById("printTeam");
  const meta = document.getElementById("printMeta");
  const ctxEl = document.getElementById("printContext");
  const logo = document.getElementById("printLogo");

  if(team) team.textContent = settings.teamName || APP_NAME;
  const parts = [];
  if(settings.category) parts.push(settings.category);
  if(settings.misterName) parts.push("Mister: " + settings.misterName);
  parts.push("Versione: " + (settings.version||VERSION));
  if(meta) meta.textContent = parts.join(" • ");

  if(ctxEl) ctxEl.textContent = contextLabel || "";

  if(logo){
    if(settings.logoDataUrl){
      logo.src = settings.logoDataUrl;
      logo.style.display = "block";
    }else{
      logo.removeAttribute("src");
      logo.style.display = "none";
    }
  }
}

function buildAttendanceSummary(){
  const monthKey = $("monthSelect").value;
  const dates = trainingDatesForMonth(monthKey);
  const recordedDays = getRecordedAttendanceDays(monthKey);
  const totalSessions = recordedDays.length;

  const att = getAttendance(monthKey);

  const wrap = document.getElementById("attendanceSummary");
  if(!wrap) return;
  wrap.innerHTML = "";

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  ["Nome e Cognome","Totale presenze","Percentuale"].forEach(t=>{
    const th=document.createElement("th"); th.textContent=t; trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  roster.forEach(p=>{
    const row = document.createElement("tr");
    const count = Object.values(att[p.id]||{}).filter(Boolean).length;
    const pct = totalSessions ? Math.round((count/totalSessions)*100) : 0;

    const td1=document.createElement("td"); td1.textContent=p.name;
    const td2=document.createElement("td"); td2.textContent=String(count) + " / " + String(totalSessions);
    const td3=document.createElement("td"); td3.textContent=String(pct) + "%";

    row.appendChild(td1); row.appendChild(td2); row.appendChild(td3);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);

  const [yStr,mStr] = monthKey.split("-");
  const monthLabel = Utils.itMonth(parseInt(mStr,10)-1) + " " + yStr;
  setPrintHeader("Presenze — " + monthLabel);
}

// Stampa presenze: tabella completa (giorni del mese) in formato compatto, per stare su 1 pagina.
function buildAttendancePrintTable(){
  const monthKey = $("monthSelect").value;
  const dates = trainingDatesForMonth(monthKey); // Lun/Mer/Gio
  const recordedDays = getRecordedAttendanceDays(monthKey);
  const totalSessions = recordedDays.length;
  const att = getAttendance(monthKey);

  const wrap = document.getElementById("attendanceSummary");
  if(!wrap) return;
  wrap.innerHTML = "";

  // Stampa presenze: SOLO lista nomi (niente foto)
  const table = document.createElement("table");
  table.className = "print-att-simple";

  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Giocatore</th><th>Presenze</th><th>%</th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for(const p of roster){
    const row = document.createElement("tr");
    const count = Object.values(att[p.id]||{}).filter(Boolean).length;
    const pct = totalSessions ? Math.round((count/totalSessions)*100) : 0;

    const tdN = document.createElement("td");
    tdN.textContent = p.name;

    const tdC = document.createElement("td");
    tdC.textContent = String(count) + " / " + String(totalSessions);

    const tdP = document.createElement("td");
    tdP.textContent = String(pct) + "%";

    row.appendChild(tdN);
    row.appendChild(tdC);
    row.appendChild(tdP);
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);

  const [yStr,mStr] = monthKey.split("-");
  const monthLabel = Utils.itMonth(parseInt(mStr,10)-1) + " " + yStr;
  setPrintHeader("Presenze — " + monthLabel + " (" + trainingDaysLabel() + ")");
}

function buildRosterPrintTable(){
  const wrap = document.getElementById("rosterList");
  if(!wrap) return;

  let printWrap = document.getElementById("rosterPrint");
  if(!printWrap){
    printWrap = document.createElement("div");
    printWrap.id = "rosterPrint";
    printWrap.className = "roster-print";
    wrap.parentNode.insertBefore(printWrap, wrap);
  }
  printWrap.innerHTML = "";

  const table = document.createElement("table");
  table.className = "print-roster";
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>#</th><th>Giocatore</th><th>Ruolo</th></tr>";
  table.appendChild(thead);
  const tbody = document.createElement("tbody");

  const sorted = [...roster].sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  for(const p of sorted){
    const tr = document.createElement("tr");
    const role = [p.role1, p.role2].filter(Boolean).join(" / ") || "—";
    const num = (p.number!=null && String(p.number).trim()!=="") ? p.number : "";
    tr.innerHTML = `<td>${Utils.escapeHtml(num)}</td><td>${Utils.escapeHtml(p.name||"—")}</td><td>${Utils.escapeHtml(role)}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  printWrap.appendChild(table);
}


function buildMatchesPrintTable(){
  const wrap = document.getElementById("matchesList");
  if(!wrap) return;
  // nessuna modifica DOM se non ci sono partite
  if(matches.length===0) return;

  // crea una tabella compatta sopra la lista (solo per stampa)
  let printWrap = document.getElementById("matchesPrint");
  if(!printWrap){
    printWrap = document.createElement("div");
    printWrap.id = "matchesPrint";
    printWrap.className = "matches-print";
    wrap.parentNode.insertBefore(printWrap, wrap);
  }
  printWrap.innerHTML = "";

  const table = document.createElement("table");
  table.className = "print-matches";
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Data</th><th>Avversario</th><th>Tempi</th><th>Capitano</th><th>Vice</th></tr>";
  table.appendChild(thead);
  const tbody = document.createElement("tbody");

  const sorted=[...matches].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  for(const m of sorted){
    const tr = document.createElement("tr");
    const date = m.date ? m.date.split("-").reverse().join("/") : "—";
    const capName=roster.find(p=>p.id===m.captain)?.name||"—";
    const viceName=roster.find(p=>p.id===m.vice)?.name||"—";
    const score=[m.q1,m.q2,m.q3,m.q4].filter(Boolean).join(" | ") || "—";
    tr.innerHTML = `<td>${date}</td><td>${(m.opponent||"")}</td><td>${score}</td><td>${capName}</td><td>${viceName}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  printWrap.appendChild(table);
}

function preparePrint(which){
  // flag per CSS di stampa specifico
  document.body.setAttribute("data-print", which||"");
  if(which==="presenze"){
    // tabella completa del mese (compatta)
    buildAttendancePrintTable();
  }else if(which==="rosa"){
    setPrintHeader("Rosa");
    buildRosterPrintTable();
  }else if(which==="tattica"){
    setPrintHeader("Lavagna tattica");
  }else if(which==="partite"){
    setPrintHeader("Report partite");
    buildMatchesPrintTable();
  }else{
    setPrintHeader("");
  }
}

// Settings modal
const modalSettings = $("modalSettings");
$("btnSettings").addEventListener("click", ()=>{
  $("sTeam").value = settings.teamName || APP_NAME;
  const catSel = $("sCategory");
  catSel.value = "Esordienti • 9 vs 9";
  $("sMister").value = settings.misterName || "";
  $("sVersion").value = VERSION;
  $("sLogo").value = "";

  // cloud fields
  const cfg = Cloud.cfg;
  const cUrl = document.getElementById("cUrl");
  const cKey = document.getElementById("cKey");
  const cTeam = document.getElementById("cTeam");
  if(cUrl) cUrl.value = cfg.supabaseUrl || "";
  if(cKey) cKey.value = cfg.supabaseAnonKey || "";
  if(cTeam) cTeam.value = cfg.teamId || (settings.teamName||"team").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  Cloud.setStatus(Cloud.isEnabled() ? "Online ✅ (pronto)" : "Offline (solo locale)");
  modalSettings.classList.remove("hidden");
});
$("btnSettingsCancel").addEventListener("click", ()=> modalSettings.classList.add("hidden"));
modalSettings.addEventListener("click",(e)=>{ if(e.target===modalSettings) modalSettings.classList.add("hidden"); });

$("btnSettingsSave").addEventListener("click", async ()=>{
  settings.teamName = $("sTeam").value.trim() || APP_NAME;
  settings.category = "Esordienti • 9 vs 9";
  settings.misterName = $("sMister").value.trim();
  settings.version = VERSION;
  settings.trainingDays = [...FIXED_TRAINING_DAYS];
  const file = $("sLogo").files?.[0];
  if(file) settings.logoDataUrl = await Utils.fileToDataURL(file);
  Storage.set("settings", settings);
  applyBrand();
  updateTrainingDaysLabel();
  renderAttendance();
  updateNextCards();
  modalSettings.classList.add("hidden");
});

// Cloud buttons (Supabase)
const btnCloudSave = document.getElementById("btnCloudSave");
if(btnCloudSave){
  btnCloudSave.addEventListener("click", ()=>{
    Cloud.setCfg({
      supabaseUrl: (document.getElementById("cUrl")?.value||"").trim(),
      supabaseAnonKey: (document.getElementById("cKey")?.value||"").trim(),
      teamId: (document.getElementById("cTeam")?.value||"").trim(),
    });
    Cloud.setStatus(Cloud.isEnabled() ? "Online ✅ (pronto)" : "Offline (solo locale)");
  });
}

const btnCloudUpload = document.getElementById("btnCloudUpload");
if(btnCloudUpload){
  btnCloudUpload.addEventListener("click", async ()=>{
    try{
      Cloud.setStatus("Upload…");
      await Cloud.upsert();
      Cloud.setStatus("Online ✅ (caricato)");
    }catch(err){
      Cloud.setStatus("Errore cloud: " + String(err?.message||err), true);
    }
  });
}

const btnCloudDownload = document.getElementById("btnCloudDownload");
if(btnCloudDownload){
  btnCloudDownload.addEventListener("click", async ()=>{
    try{
      Cloud.setStatus("Download…");
      await Cloud.download();
      // ricarica stato in memoria
      settings = Storage.get("settings", DEFAULT_SETTINGS);
      roster = Storage.get("roster", DEFAULT_ROSTER);
      matches = Storage.get("matches", []);
      exercises = Storage.get("exercises", []);
      __waInit = false;
      applyBrand();
      renderAttendance();
      renderRoster();
      renderMatchDropdowns();
      renderMatches();
      Cloud.setStatus("Online ✅ (scaricato)");
    }catch(err){
      Cloud.setStatus("Errore cloud: " + String(err?.message||err), true);
    }
  });
}

// ------------------------------
// ESERCIZI (link salvati)
// ------------------------------

const $exList = ()=>document.getElementById("exercisesList");

function exNormalizeTags(str){
  return (str||"")
    .split(",")
    .map(s=>s.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function exPlatformLabel(url){
  const u = (url||"").toLowerCase();
  if(u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
  if(u.includes("tiktok.com")) return "TikTok";
  if(u.includes("instagram.com")) return "Instagram";
  if(u.includes("facebook.com")) return "Facebook";
  return "Link";
}

function buildExerciseCategorySelect(sel, includeAll=true){
  if(!sel) return;
  sel.innerHTML = "";
  for(const c of EX_CATEGORIES){
    if(!includeAll && c==="Tutti") continue;
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  }
}

let exEditingId = null;

function openExerciseModal(item=null){
  exEditingId = item ? item.id : null;
  $("modalExercise").classList.remove("hidden");
  $("exModalTitle").textContent = item ? "Modifica esercizio" : "Aggiungi esercizio";
  $("exUrl").value = item?.url || "";
  $("exTitle").value = item?.title || "";
  $("exMinutes").value = (item?.minutes ?? "");
  $("exTags").value = (item?.tags || []).join(", ");
  $("exNotes").value = item?.notes || "";
  $("exFav").checked = !!item?.fav;
  buildExerciseCategorySelect($("exCategory"), false);
  $("exCategory").value = item?.category || "Tecnica";
  setTimeout(()=>{ try{ $("exUrl").focus(); }catch(_){ } }, 0);
}

function closeExerciseModal(){
  $("modalExercise").classList.add("hidden");
  exEditingId = null;
}

function upsertExercise(payload){
  const now = Date.now();
  const base = {
    id: exEditingId || ("ex_" + now + "_" + Math.random().toString(16).slice(2)),
    createdAt: payload.createdAt || now,
    updatedAt: now,
    lastUsedAt: payload.lastUsedAt || null,
    fav: !!payload.fav,
    url: payload.url || "",
    title: payload.title || "",
    category: payload.category || "Tecnica",
    minutes: payload.minutes ?? null,
    tags: payload.tags || [],
    notes: payload.notes || ""
  };
  const idx = exercises.findIndex(x=>x.id===base.id);
  const next = [...exercises];
  if(idx>=0) next[idx] = { ...next[idx], ...base };
  else next.unshift(base);
  setExercises(next);
}

function deleteExercise(id){
  const next = exercises.filter(x=>x.id!==id);
  setExercises(next);
}

function toggleFavExercise(id){
  const next = exercises.map(x=> x.id===id ? { ...x, fav: !x.fav, updatedAt: Date.now() } : x);
  setExercises(next);
}

function markUsedExercise(id){
  const next = exercises.map(x=> x.id===id ? { ...x, lastUsedAt: Date.now(), updatedAt: Date.now() } : x);
  setExercises(next);
}

function renderExercises(){
  const sel = $("exCategoryFilter");
  const prev = sel ? sel.value : "Tutti";
  buildExerciseCategorySelect(sel, true);
  if(sel) sel.value = prev || "Tutti";

  const q = ($("exSearch").value||"").trim().toLowerCase();
  const cat = $("exCategoryFilter").value || "Tutti";
  const onlyFav = !!$("exOnlyFav").checked;

  const filtered = exercises.filter(x=>{
    if(onlyFav && !x.fav) return false;
    if(cat && cat!=="Tutti" && (x.category||"")!==cat) return false;
    if(!q) return true;
    const hay = [x.title, x.url, (x.tags||[]).join(" "), x.notes].join(" ").toLowerCase();
    return hay.includes(q);
  });

  const empty = document.getElementById("exEmpty");
  if(empty) empty.style.display = exercises.length ? "none" : "block";

  const list = $exList();
  if(!list) return;
  list.innerHTML = "";

  for(const ex of filtered){
    const platform = exPlatformLabel(ex.url);
    const el = document.createElement("div");
    el.className = "exercise";

    const title = Utils.escapeHtml(ex.title || (platform + " — esercizio"));
    const catTxt = Utils.escapeHtml(ex.category||"-");
    const urlAttr = Utils.escapeAttr(ex.url||"");
    const minutes = ex.minutes ? `<span class="badge">${Utils.escapeHtml(String(ex.minutes))} min</span>` : "";
    const favBadge = ex.fav ? `<span class="badge fav">★</span>` : "";

    const used = ex.lastUsedAt ? `<span class="dot">•</span><span class="muted">Usato: ${Utils.escapeHtml(Utils.itDate(new Date(ex.lastUsedAt)))}</span>` : "";

    const tags = (ex.tags && ex.tags.length)
      ? `<div class="tags">${ex.tags.map(t=>`<span class="tag">${Utils.escapeHtml(t)}</span>`).join("")}</div>`
      : "";

    const notes = ex.notes ? `<div class="exercise-notes">${Utils.escapeHtml(ex.notes)}</div>` : "";

    el.innerHTML = `
      <div class="exercise-main">
        <div class="exercise-top">
          <div class="exercise-title">${title}</div>
          <div class="exercise-badges">
            ${favBadge}
            <span class="badge">${catTxt}</span>
            ${minutes}
          </div>
        </div>
        <div class="exercise-meta">
          <span class="muted">${Utils.escapeHtml(platform)}</span>
          <span class="dot">•</span>
          <a class="link" href="${urlAttr}" target="_blank" rel="noopener">Apri link</a>
          ${used}
        </div>
        ${tags}
        ${notes}
      </div>
      <div class="exercise-actions">
        <button class="btn ghost" data-act="used" title="Segna come usato oggi">✓ Usato</button>
        <button class="btn ghost" data-act="fav" title="Preferito">★</button>
        <button class="btn ghost" data-act="edit" title="Modifica">✎</button>
        <button class="btn ghost" data-act="del" title="Elimina">🗑</button>
      </div>
    `;

    el.querySelectorAll("button[data-act]").forEach(b=>{
      b.addEventListener("click", ()=>{
        const act = b.dataset.act;
        if(act==="used"){ markUsedExercise(ex.id); renderExercises(); }
        if(act==="fav"){ toggleFavExercise(ex.id); renderExercises(); }
        if(act==="edit"){ openExerciseModal(ex); }
        if(act==="del"){
          if(confirm("Eliminare questo esercizio?")){
            deleteExercise(ex.id);
            renderExercises();
          }
        }
      });
    });

    list.appendChild(el);
  }

  if(exercises.length && filtered.length===0){
    const msg = document.createElement("div");
    msg.className = "hint";
    msg.style.marginTop = "10px";
    msg.textContent = "Nessun risultato con questi filtri.";
    list.appendChild(msg);
  }
}

// Eventi UI esercizi
const btnAddExercise = document.getElementById("btnAddExercise");
if(btnAddExercise) btnAddExercise.addEventListener("click", ()=>openExerciseModal(null));

const btnExerciseCancel = document.getElementById("btnExerciseCancel");
if(btnExerciseCancel) btnExerciseCancel.addEventListener("click", closeExerciseModal);

const btnExerciseSave = document.getElementById("btnExerciseSave");
if(btnExerciseSave) btnExerciseSave.addEventListener("click", ()=>{
  const url = ($("exUrl").value||"").trim();
  const title = ($("exTitle").value||"").trim();
  const category = $("exCategory").value || "Tecnica";
  const minutesRaw = ($("exMinutes").value||"").trim();
  const minutes = minutesRaw ? Math.max(0, parseInt(minutesRaw,10) || 0) : null;
  const tags = exNormalizeTags($("exTags").value);
  const notes = ($("exNotes").value||"").trim();
  const fav = !!$("exFav").checked;

  if(!url){ alert("Incolla un link."); return; }
  const finalTitle = title || (exPlatformLabel(url) + " — esercizio");

  upsertExercise({ url, title: finalTitle, category, minutes, tags, notes, fav });
  closeExerciseModal();
  renderExercises();
});

["exSearch","exCategoryFilter","exOnlyFav"].forEach(id=>{
  const el = document.getElementById(id);
  if(!el) return;
  el.addEventListener("input", ()=>renderExercises());
  el.addEventListener("change", ()=>renderExercises());
});

// Export/Import (JSON)
const btnExportExercises = document.getElementById("btnExportExercises");
if(btnExportExercises) btnExportExercises.addEventListener("click", ()=>{
  const payload = { exportedAt: new Date().toISOString(), exercises };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "esercizi.json";
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 200);
});

const btnImportExercises = document.getElementById("btnImportExercises");
const exImportFile = document.getElementById("exImportFile");
if(btnImportExercises && exImportFile){
  btnImportExercises.addEventListener("click", ()=> exImportFile.click());
  exImportFile.addEventListener("change", async ()=>{
    const file = exImportFile.files && exImportFile.files[0];
    if(!file) return;
    try{
      const txt = await file.text();
      const json = JSON.parse(txt);
      const arr = Array.isArray(json) ? json : (Array.isArray(json.exercises) ? json.exercises : []);
      if(!arr.length){ alert("File non valido o vuoto."); return; }

      const map = new Map(exercises.map(x=>[x.id,x]));
      for(const item of arr){
        if(!item || !item.url) continue;
        const id = item.id || ("ex_" + Date.now() + "_" + Math.random().toString(16).slice(2));
        map.set(id, {
          id,
          createdAt: item.createdAt || Date.now(),
          updatedAt: Date.now(),
          lastUsedAt: item.lastUsedAt || null,
          fav: !!item.fav,
          url: String(item.url||""),
          title: String(item.title||exPlatformLabel(item.url)+" — esercizio"),
          category: String(item.category||"Tecnica"),
          minutes: (item.minutes==null? null : (parseInt(item.minutes,10)||0)),
          tags: Array.isArray(item.tags)? item.tags.map(String).slice(0,12) : exNormalizeTags(item.tags),
          notes: String(item.notes||"")
        });
      }
      setExercises(Array.from(map.values()).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)));
      alert("Import completato.");
      renderExercises();
    }catch(e){
      alert("Errore import: " + (e?.message||e));
    }finally{
      exImportFile.value = "";
    }
  });
}

// chiudi modal con click fuori
const modalExercise = document.getElementById("modalExercise");
if(modalExercise){
  modalExercise.addEventListener("click", (e)=>{ if(e.target===modalExercise) closeExerciseModal(); });
}
// Print buttons
function printNow(which){ preparePrint(which); window.print(); }
$("btnPrintAttendance").addEventListener("click", ()=>printNow("presenze"));
const rollcallListEl = document.getElementById("rollcallList");
if(rollcallListEl){
  rollcallListEl.addEventListener("click", (e)=>{
    const row = e.target.closest(".rollcall-player");
    if(!row) return;
    const id = row.dataset.player;
    if(!id) return;
    if(rollcallDraft.absent.has(id)) rollcallDraft.absent.delete(id);
    else rollcallDraft.absent.add(id);
    renderRollcall(rollcallDraft.monthKey, rollcallDraft.iso);
  });
}
const btnResetRollcall = document.getElementById("btnResetRollcall");
if(btnResetRollcall) btnResetRollcall.addEventListener("click", ()=>{
  rollcallDraft.absent = new Set();
  renderRollcall(rollcallDraft.monthKey, rollcallDraft.iso);
});
const btnSaveRollcall = document.getElementById("btnSaveRollcall");
if(btnSaveRollcall) btnSaveRollcall.addEventListener("click", ()=>{
  const monthKey = $("monthSelect").value;
  const iso = Storage.get("attSelectedDay:" + monthKey, "");
  if(!iso) return;
  loadRollcallDraft(monthKey, iso);
  const att = getAttendance(monthKey);
  for(const p of roster){
    if(!att[p.id]) att[p.id] = {};
    if(rollcallDraft.absent.has(p.id)) delete att[p.id][iso];
    else att[p.id][iso] = true;
  }
  setAttendance(monthKey, att);
  const days = getRecordedAttendanceDays(monthKey);
  if(!days.includes(iso)) days.push(iso);
  setRecordedAttendanceDays(monthKey, days);
  renderAttendance();
  alert(`Presenze salvate: ${roster.length-rollcallDraft.absent.size} presenti, ${rollcallDraft.absent.size} assenti.`);
});

$("btnPrintRoster").addEventListener("click", ()=>printNow("rosa"));
// btnPrintBoard (vecchia pagina Tattiche) rimosso
$("btnPrintMatches").addEventListener("click", ()=>printNow("partite"));

// Boot
// allinea sempre la versione visualizzata
settings.version = VERSION;
Storage.set("settings", settings);
Storage.set("roster", roster);
Storage.set("matches", matches);

renderAttendance();
renderRoster();
renderMatchDropdowns();
renderMatches();
renderBoardRoster();
updateNextCards();

setTool("none");
setTab("presenze");
setTimeout(()=>{ try{ resizeInk(); }catch(_){ } }, 0);

// Il tasto "Esci" della nuova lavagna è gestito da btnBoardClose.



// Extra safeguard for Safari: keep board measured correctly
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden){ setTimeout(()=>{ updateViewportVars(); safeBoardResize(); }, 120); }});

// PROGRAMMAZIONE ALLENAMENTI 2026/27 — mobile first
const PROGRAM = window.MISTER_FAB_PROGRAM || null;
let currentProgramSession = null;
function programState(){ const s=Storage.get('programState',{notes:{},done:{}}); s.notes=s.notes||{}; s.done=s.done||{}; return s; }
function saveProgramState(s){ Storage.set('programState',s); }
function itLongDate(iso){ const d=new Date(iso+'T12:00:00'); const wd=['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'][d.getDay()]; return `${wd} ${d.getDate()} ${Utils.itMonth(d.getMonth())} ${d.getFullYear()}`; }
function renderProgrammazione(){ if(!PROGRAM)return; const sel=$('programMonthSelect'); if(sel&&!sel.dataset.ready){ sel.innerHTML=PROGRAM.months.map(m=>`<option value="${m.id}">${Utils.escapeHtml(m.name)}</option>`).join(''); sel.dataset.ready='1'; sel.addEventListener('change',()=>renderProgramMonth(sel.value)); } $('programSeason').textContent=PROGRAM.season; renderProgramMonth(sel?.value||PROGRAM.months[0].id); }
function renderProgramAnnual(){ const box=$('programAnnual'); if(!box)return; box.innerHTML=PROGRAM.annual.map(([m,f],i)=>`<div class="annual-row ${i===0?'current':''}"><div class="annual-month">${Utils.escapeHtml(m)}</div><div class="annual-focus">${Utils.escapeHtml(f)}</div></div>`).join(''); }
function renderProgramMonth(id){ const m=PROGRAM.months.find(x=>x.id===id)||PROGRAM.months[0]; $('programMonthTitle').textContent=m.name; $('programSessionCount').textContent=`${m.sessions.length} allenamenti • ${m.sessions.length*90} min`; const state=programState(); $('programSessionList').innerHTML=m.sessions.map((s,i)=>`<button class="program-session-card ${state.done[s.id]?'done':''}" data-session-id="${s.id}" type="button"><div class="psc-num">${String(i+1).padStart(2,'0')}</div><div class="psc-main"><div class="psc-date">${Utils.escapeHtml(itLongDate(s.date))}</div><div class="psc-title">${Utils.escapeHtml(s.title)}</div><div class="psc-focus">${Utils.escapeHtml(s.focus)}</div></div><div class="psc-side"><b>90'</b><span>${s.exercises.length} esercizi</span><em>${state.done[s.id]?'✓ svolta':'Apri ›'}</em></div></button>`).join(''); $('programSessionList').querySelectorAll('[data-session-id]').forEach(b=>b.addEventListener('click',()=>openProgramSession(b.dataset.sessionId))); }
function getProgramSession(id){ for(const m of PROGRAM.months){ const s=m.sessions.find(x=>x.id===id); if(s)return s; } return null; }
function openProgramSession(id){ const s=getProgramSession(id); if(!s)return; currentProgramSession=s; $('programModalDate').textContent=itLongDate(s.date); $('programModalTitle').textContent=s.title; $('programModalFocus').textContent=s.focus; $('programModalDuration').textContent=s.duration; const st=programState(); $('programSessionNotes').value=st.notes[s.id]||''; $('programSessionDone').checked=!!st.done[s.id]; const box=$('programExerciseList'); box.innerHTML=''; s.exercises.forEach((ex,i)=>box.appendChild(buildProgramExercise(ex,i+1))); $('modalProgramSession').classList.remove('hidden'); document.body.classList.add('modal-open'); $('modalProgramSession').scrollTop=0; }
function closeProgramSession(){ $('modalProgramSession')?.classList.add('hidden'); document.body.classList.remove('modal-open'); currentProgramSession=null; }
function buildProgramExercise(ex,n){ const b=document.createElement('button'); b.type='button'; b.className='program-exercise-row'; b.innerHTML=`<span class="pe-num">${String(n).padStart(2,'0')}</span><span class="pe-title"><b>${Utils.escapeHtml(ex.title)}</b><small>${Utils.escapeHtml(ex.objective)}</small></span><span class="pe-min">${ex.minutes}'</span><span class="pe-open">›</span>`; b.addEventListener('click',()=>openProgramExercise(ex,n)); return b; }
function openProgramExercise(ex,n){ if(!currentProgramSession)return; $('exerciseModalSession').textContent=`${itLongDate(currentProgramSession.date)} • ESERCIZIO ${String(n).padStart(2,'0')}`; $('exerciseModalTitle').textContent=ex.title; $('exerciseModalObjective').textContent=ex.objective; $('exerciseModalMinutes').textContent=`⏱ ${ex.minutes}'`; $('exerciseModalSpace').textContent=`📐 ${ex.space}`; $('exerciseModalDiagram').innerHTML=trainingDiagramSvg(ex); $('exerciseModalInfo').innerHTML=`<div><b>OBIETTIVO</b><p>${Utils.escapeHtml(ex.objective)}</p></div><div><b>MATERIALE</b><p>${Utils.escapeHtml(ex.material)}</p></div><div class="wide"><b>SVOLGIMENTO</b><p>${Utils.escapeHtml(ex.execution)}</p></div><div class="wide coach"><b>COSA OSSERVARE / CORREGGERE</b><p>${Utils.escapeHtml(ex.coaching)}</p></div><div class="wide"><b>VARIANTE</b><p>${Utils.escapeHtml(ex.variant)}</p></div>`; $('modalProgramSession').classList.add('hidden'); $('modalProgramExercise').classList.remove('hidden'); $('modalProgramExercise').scrollTop=0; }
function closeProgramExercise(){ $('modalProgramExercise')?.classList.add('hidden'); if(currentProgramSession)$('modalProgramSession')?.classList.remove('hidden'); }
function trainingDiagramSvg(ex){
 const t=ex.diagram||'match', P=(x,y,c='#D0A057',l='')=>`<g><circle cx="${x}" cy="${y}" r="16" fill="${c}" stroke="#fff" stroke-width="3"/>${l?`<text x="${x}" y="${y+4}" text-anchor="middle" fill="#fff" font-size="11" font-weight="800">${l}</text>`:''}</g>`, B=(x,y)=>`<circle cx="${x}" cy="${y}" r="9" fill="#fff" stroke="#111" stroke-width="3"/>`, A=(x1,y1,x2,y2,c='#D0A057',dash='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="5" ${dash?`stroke-dasharray="${dash}"`:''} marker-end="url(#a)"/>`, C=(x,y)=>`<path d="M${x} ${y-10}l-9 18h18z" fill="#D0A057" stroke="#111"/>`; let g='';
 if(t==='slalom'){ for(let i=0;i<6;i++)g+=C(150+i*65,i%2?225:135); g+=P(85,180)+B(110,180)+`<path d="M110 180C160 100 210 260 275 145S390 250 500 160" fill="none" stroke="#D0A057" stroke-width="6" marker-end="url(#a)"/>`; }
 else if(t==='passing_pairs'){ g+=P(150,115)+P(490,115)+P(150,250)+P(490,250)+B(175,115)+A(180,115,455,115,'#fff','12 8')+A(460,250,185,250,'#fff','12 8'); }
 else if(t==='triangle'){ g+=P(160,260)+P(320,80)+P(500,260)+B(185,250)+A(190,245,300,105,'#fff','12 8')+A(340,105,475,245,'#fff','12 8')+A(470,270,190,270,'#fff','12 8'); }
 else if(t==='rondo'){ [[150,90],[490,90],[150,270],[490,270]].forEach(p=>g+=P(...p)); g+=P(290,160,'#111')+P(350,210,'#111')+B(180,100)+A(175,90,455,90,'#fff','12 8'); }
 else if(t==='one_v_one'){ g+=P(200,180,'#D0A057','A')+P(340,180,'#111','D')+B(225,180)+A(240,180,500,140)+`<rect x="525" y="120" width="35" height="120" fill="none" stroke="#fff" stroke-width="5"/>`; }
 else if(t==='two_v_one'){ g+=P(130,120,'#D0A057','A')+P(130,245,'#D0A057','A')+P(345,180,'#111','D')+B(155,120)+A(165,120,320,165)+A(160,245,480,220,'#fff','12 8')+`<rect x="525" y="120" width="35" height="120" fill="none" stroke="#fff" stroke-width="5"/>`; }
 else if(t==='three_v_two'){ [[130,90],[130,180],[130,270]].forEach(p=>g+=P(...p)); [[340,135],[340,225]].forEach(p=>g+=P(...p,'#111')); g+=B(155,180)+A(165,180,315,150)+A(365,135,500,125,'#fff','12 8')+`<rect x="530" y="115" width="35" height="130" fill="none" stroke="#fff" stroke-width="5"/>`; }
 else if(t==='transition'){ [[190,105],[190,255],[300,180]].forEach(p=>g+=P(...p)); [[440,105],[440,255],[350,180]].forEach(p=>g+=P(...p,'#111')); g+=B(325,180)+A(350,180,520,95,'#E20F17')+A(300,180,120,260); }
 else if(t==='jokers'||t==='zones'){ if(t==='zones')g+=`<line x1="215" y1="30" x2="215" y2="330" stroke="#D0A057" stroke-width="3" opacity=".7"/><line x1="425" y1="30" x2="425" y2="330" stroke="#D0A057" stroke-width="3" opacity=".7"/>`; [[230,105],[230,250],[410,105],[410,250]].forEach(p=>g+=P(...p)); [[305,150],[345,210]].forEach(p=>g+=P(...p,'#111')); g+=P(90,180,'#0E8A45','J')+P(550,180,'#0E8A45','J')+B(250,105)+A(260,105,515,180,'#fff','12 8'); }
 else if(t==='build'){ g+=`<rect x="55" y="115" width="35" height="130" fill="none" stroke="#fff" stroke-width="5"/>`+P(120,180,'#111','P')+P(230,95)+P(230,265)+P(360,180)+P(320,125,'#111')+P(320,235,'#111')+B(145,180)+A(150,175,205,110,'#fff','12 8')+A(250,95,345,165,'#fff','12 8')+A(380,180,520,180); }
 else if(t==='finish'){ g+=P(120,235)+P(270,200)+P(400,120)+B(145,235)+A(155,225,245,205,'#fff','12 8')+A(295,190,380,130,'#fff','12 8')+A(420,130,520,180,'#E20F17')+`<rect x="540" y="120" width="35" height="120" fill="none" stroke="#fff" stroke-width="5"/>`; }
 else if(t==='huddle'){ [[260,120],[320,95],[380,120],[235,195],[405,195],[280,260],[360,260]].forEach(p=>g+=P(...p)); g+=`<text x="320" y="195" text-anchor="middle" fill="#fff" font-size="22" font-weight="900">FEEDBACK</text>`; }
 else if(t==='scanning'){ g+=P(320,180)+P(120,180)+P(520,180)+B(145,180)+A(160,180,292,180,'#fff','12 8')+`<path d="M305 145Q320 120 335 145" fill="none" stroke="#D0A057" stroke-width="5" marker-end="url(#a)"/>`+C(320,80)+C(320,280); }
 else if(t==='support'){ g+=P(170,180)+P(320,95)+P(320,265)+P(450,180,'#111')+B(195,180)+A(200,175,295,110,'#fff','12 8')+A(200,190,295,250,'#fff','12 8'); }
 else if(t==='two_v_two'){ g+=P(150,120)+P(150,240)+P(350,130,'#111')+P(350,230,'#111')+B(175,120)+A(180,120,320,140)+A(175,240,500,220,'#fff','12 8')+`<rect x="530" y="120" width="35" height="120" fill="none" stroke="#fff" stroke-width="5"/>`; }
 else if(t==='overlap'){ g+=P(150,180)+P(155,270)+P(355,190,'#111')+B(175,180)+A(180,180,330,190)+`<path d="M175 270C260 270 310 245 390 210" fill="none" stroke="#D0A057" stroke-width="5" marker-end="url(#a)"/>`+A(380,205,520,175,'#fff','12 8'); }
 else if(t==='third_man'){ g+=P(140,220,'#D0A057','A')+P(320,150,'#D0A057','B')+P(500,95,'#D0A057','C')+B(165,215)+A(175,210,295,160,'#fff','12 8')+A(315,175,470,105,'#fff','12 8')+A(165,235,465,115); }
 else if(t==='switch'){ g+=`<line x1="215" y1="30" x2="215" y2="330" stroke="#fff" opacity=".35" stroke-width="2"/><line x1="425" y1="30" x2="425" y2="330" stroke="#fff" opacity=".35" stroke-width="2"/>`+P(120,180)+P(300,130)+P(515,190)+P(330,245,'#111')+P(375,165,'#111')+B(145,180)+A(150,180,280,140,'#fff','12 8')+A(315,135,490,185,'#fff','12 8'); }
 else if(t==='depth'){ g+=P(150,210)+P(230,100)+P(340,180,'#111')+B(175,210)+A(180,210,320,190)+`<path d="M235 100C330 90 405 95 500 130" fill="none" stroke="#D0A057" stroke-width="5" marker-end="url(#a)"/>`+A(300,195,480,135,'#fff','12 8'); }
 else if(t==='wide_finish'){ g+=P(120,245)+P(250,245)+P(400,105)+P(395,180)+P(395,255,'#111')+B(145,245)+A(160,245,225,245,'#fff','12 8')+A(275,235,500,165,'#fff','12 8')+`<path d="M270 245C360 270 430 260 500 210" fill="none" stroke="#D0A057" stroke-width="5" marker-end="url(#a)"/>`+`<rect x="535" y="120" width="35" height="120" fill="none" stroke="#fff" stroke-width="5"/>`; }
 else if(t==='press'){ g+=P(180,110)+P(180,250)+P(430,110)+P(430,250)+P(330,180,'#111')+P(380,180,'#111')+B(205,110)+A(215,115,310,165,'#E20F17')+A(400,170,445,125,'#E20F17'); }
 else if(t==='compact'){ g+=P(145,85,'#111')+P(145,275,'#111')+B(170,85)+[[300,95],[300,155],[300,215],[300,275]].forEach(p=>g+=P(...p,'#D0A057'))+A(175,90,270,110,'#E20F17')+`<path d="M300 80L300 290" stroke="#D0A057" stroke-width="3" stroke-dasharray="10 7"/>`; }
 else { for(let i=0;i<6;i++){const x=105+(i%3)*105,y=90+Math.floor(i/3)*160;g+=P(x,y);g+=A(x+20,y,x+55,y+(i%2?20:-20));} for(let i=0;i<5;i++){const x=535-(i%3)*90,y=100+Math.floor(i/3)*150;g+=P(x,y,'#111');} g+=B(320,180); }
 return `<svg viewBox="0 0 640 360" role="img" aria-label="Schema ${Utils.escapeAttr(ex.title)}"><defs><marker id="a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker><pattern id="g" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="#225f32"/><rect width="40" height="80" fill="#286b38"/></pattern></defs><rect x="4" y="4" width="632" height="352" rx="20" fill="url(#g)" stroke="#fff" stroke-width="4"/><line x1="320" y1="5" x2="320" y2="355" stroke="#fff" opacity=".55" stroke-width="3"/><circle cx="320" cy="180" r="55" fill="none" stroke="#fff" opacity=".55" stroke-width="3"/>${g}<rect x="16" y="16" width="235" height="34" rx="12" fill="#070707" opacity=".82"/><text x="30" y="39" fill="#D0A057" font-size="17" font-weight="900">${Utils.escapeHtml(ex.title).slice(0,28)}</text></svg>`;
}
function saveCurrentProgramNotes(){ if(!currentProgramSession)return; const st=programState(); st.notes[currentProgramSession.id]=$('programSessionNotes').value.trim(); st.done[currentProgramSession.id]=$('programSessionDone').checked; saveProgramState(st); renderProgramMonth($('programMonthSelect').value); const b=$('btnProgramSave'); const old=b.textContent; b.textContent='Salvato ✓'; setTimeout(()=>b.textContent=old,900); }
function printProgramSession(){ const s=currentProgramSession;if(!s)return; const w=window.open('','_blank');if(!w)return; const exs=s.exercises.map((ex,i)=>`<section><h3>${i+1}. ${Utils.escapeHtml(ex.title)} <span>${ex.minutes}'</span></h3>${trainingDiagramSvg(ex)}<p><b>Obiettivo:</b> ${Utils.escapeHtml(ex.objective)}</p><p><b>Spazio:</b> ${Utils.escapeHtml(ex.space)} — <b>Materiale:</b> ${Utils.escapeHtml(ex.material)}</p><p><b>Svolgimento:</b> ${Utils.escapeHtml(ex.execution)}</p><p><b>Correzioni:</b> ${Utils.escapeHtml(ex.coaching)}</p><p><b>Variante:</b> ${Utils.escapeHtml(ex.variant)}</p></section>`).join(''); w.document.write(`<!doctype html><meta charset="utf-8"><title>${Utils.escapeHtml(s.title)}</title><style>body{font-family:Arial;margin:24px}h1{border-bottom:4px solid #D0A057}h3{display:flex;justify-content:space-between;background:#111;color:#fff;padding:8px}section{break-inside:avoid;margin-bottom:20px}svg{width:100%;max-width:650px;height:auto}p{font-size:12px;line-height:1.4}</style><h1>${Utils.escapeHtml(s.title)}</h1><p>${Utils.escapeHtml(itLongDate(s.date))} • 90 minuti • ${Utils.escapeHtml(s.focus)}</p>${exs}<script>window.onload=()=>window.print()<\/script>`);w.document.close(); }
$('btnExerciseClose')?.addEventListener('click',closeProgramExercise); $('modalProgramExercise')?.addEventListener('click',e=>{if(e.target===$('modalProgramExercise'))closeProgramExercise();}); $('btnProgramClose')?.addEventListener('click',closeProgramSession); $('btnProgramSave')?.addEventListener('click',saveCurrentProgramNotes); $('btnProgramPrint')?.addEventListener('click',printProgramSession); $('modalProgramSession')?.addEventListener('click',e=>{if(e.target===$('modalProgramSession'))closeProgramSession();});

