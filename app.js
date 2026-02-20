/* Gestione Squadra */
// App version (usata anche nel PDF e nel Service Worker cache-bust)
const VERSION = "1.1.3";

const ROLES = ["", "portiere", "difensore", "centrocampista", "ala destra", "ala sinistra", "attaccante"];
const CATEGORIES = ["", "Primi calci", "Piccoli amici", "Pulcini 1° anno", "Pulcini 2° anno", "Pulcini misti", "Esordienti 1° anno", "Esordienti 2° anno", "Esordienti misti"];

const Storage = {
  get(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(_){ return fallback; }
  },
  set(key, value){ localStorage.setItem(key, JSON.stringify(value)); },
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

function fileKeyFor(id){ return id==="guz" ? "13" : id; }

function photoUrlForPlayerBg(player){
  if(player.photoDataUrl) return player.photoDataUrl;
  const key=fileKeyFor(player.id);
  // Prefer PNG for background (set, and most assets are png)
  return `assets/players/${key}.png`;
}

function avatarNode(player){
  if(player.photoDataUrl){
    const img=document.createElement("img");
    img.className="avatar";
    img.src=player.photoDataUrl;
    img.alt="";
    return img;
  }
  const key=fileKeyFor(player.id);
  const base=`assets/players/${key}`;
  const candidates=[`${base}.jpg`, `${base}.jpeg`, `${base}.png`, `${base}.webp`];

  const img=document.createElement("img");
  img.className="avatar";
  img.alt="";
  img.src=candidates[0];

  let idx=1;
  img.onerror=()=>{
    if(idx < candidates.length){
      img.src = candidates[idx++];
      return;
    }
    const div=document.createElement("div");
    div.className="avatar";
    div.textContent = Utils.initials(player.name);
    div.style.display="grid";
    div.style.placeItems="center";
    div.style.fontWeight="1000";
    img.replaceWith(div);
  };
  return img;
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

// Default data
const DEFAULT_ROSTER = [
  { id:"1",  name:"BATTAGLIA RICCARDO", role1:"", role2:"", number:"" , photoDataUrl:"assets/players/1.png" },
  { id:"5",  name:"BENMIMOUN AMIR", role1:"", role2:"", number:"" , photoDataUrl:"assets/players/5.png" },
  { id:"9",  name:"BENMIMOUN HEDI", role1:"", role2:"", number:"" , photoDataUrl:"assets/players/9.png" },
  { id:"11", name:"BURIOLA ELIA", role1:"", role2:"", number:"" , photoDataUrl:"assets/players/11.png" },
  { id:"7",  name:"CASONATO CHRISTIAN", role1:"", role2:"", number:"" , photoDataUrl:"assets/players/7.png" },
  { id:"8",  name:"DE GIUSTI GIACOMO", role1:"", role2:"", number:"" , photoDataUrl:"assets/players/8.png" },
  { id:"4",  name:"GHIRARDO GABRIEL", role1:"", role2:"", number:"" , photoDataUrl:"assets/players/4.png" },
  { id:"6",  name:"GHIRARDO GIANMARIA", role1:"", role2:"", number:"" , photoDataUrl:"assets/players/6.png" },
  { id:"guz",name:"GUZ PATRICK", role1:"", role2:"", number:"" , photoDataUrl:"assets/players/13.png" },
  { id:"12", name:"HALLULLI LEON", role1:"", role2:"", number:"" , photoDataUrl:"assets/players/12.png" },
  { id:"3",  name:"MARKU OREST", role1:"", role2:"", number:"" , photoDataUrl:"assets/players/3.png" },
  { id:"10", name:"SONEGO LEONARDO", role1:"", role2:"", number:"" , photoDataUrl:"assets/players/10.png" },
  { id:"2",  name:"ZULIANI EVAN", role1:"", role2:"", number:"" , photoDataUrl:"assets/players/2.png" },
];

const DEFAULT_SETTINGS = { version: VERSION, teamName:"Gestione Squadra", category:"", misterName:"", logoDataUrl:"" };

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
      attendance: {}
    };
    // raccoglie tutte le presenze presenti in localStorage (att:YYYY-MM)
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(!k || !k.startsWith("att:")) continue;
      const monthKey = k.slice(4);
      out.attendance[monthKey] = Storage.get(k, {});
    }
    return out;
  }

  function importAll(payload){
    if(!payload || typeof payload !== "object") throw new Error("Dati cloud non validi");
    if(payload.settings) Storage.set("settings", payload.settings);
    if(payload.roster) Storage.set("roster", payload.roster);
    if(payload.matches) Storage.set("matches", payload.matches);
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
if(settings.version !== VERSION){
  settings.version = VERSION;
  Storage.set("settings", settings);
}
let roster = Storage.get("roster", null) || DEFAULT_ROSTER;
let matches = Storage.get("matches", []);

function getAttendance(key){ return Storage.get("att:"+key, {}); }
function setAttendance(key, data){ Storage.set("att:"+key, data); }

// Navigation
const pages = {
  presenze: $("page-presenze"),
  rosa: $("page-rosa"),
  partite: $("page-partite"),
};
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
  $("teamTitle").textContent = settings.teamName || "Gestione Squadra";
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

// Month select
function buildMonthSelect(){
  const sel = $("monthSelect");
  sel.innerHTML = "";
  // Richiesta: partire da Gennaio 2027 (evita anni "vecchi" come 2025).
  const startYear = 2026;
  const years = Array.from({length: 6}, (_,i)=> startYear + i); // 2026..2031
  for(const y of years){
    for(let m=1;m<=12;m++){
      const key = `${y}-${Utils.pad2(m)}`;
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = `${Utils.itMonth(m-1)} ${y}`;
      sel.appendChild(opt);
    }
  }
  const stored = Storage.get("attSelectedMonth", `${startYear}-01`);
  sel.value = Array.from(sel.options).some(o=>o.value===stored) ? stored : `${startYear}-01`;
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
    if(wd===1||wd===3||wd===4){
      out.push({ iso: Utils.toISO(y,m,d.getDate()), day:d.getDate(), wd });
    }
    d.setDate(d.getDate()+1);
  }
  return out;
}

function updateNextCards(){
  const today = new Date();
  const key = Utils.monthKey(today);
  const dates = trainingDatesForMonth(key).map(x=>x.iso);
  const next = dates.find(iso=> new Date(iso+"T00:00:00") >= new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  $("nextTraining").textContent = next ? next.split("-").reverse().join("/") : "—";

  const future = matches
    .filter(m=>m.date)
    .map(m=>({ ...m, t:new Date(m.date+"T00:00:00") }))
    .filter(m=>m.t >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
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
      const present = !!att[p.id][d.iso];
      if(present) count++;
      dot.className = "dot" + (present ? " on" : "");
      dot.dataset.date = d.iso;
      dot.dataset.player = p.id;
      if(d.iso===todayIso) dot.classList.add("today");
      td.appendChild(dot);
      tr.appendChild(td);
    }

    const tdPct = document.createElement("td");
    const total = dates.length || 1;
    tdPct.className = "pct-cell";
    tdPct.textContent = String(Math.round((count/total)*100)) + "%";
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

  const dot = e.target.closest(".dot");
  if(!dot) return;
  const playerId = dot.dataset.player;
  const iso = dot.dataset.date;
  if(!playerId || !iso) return;

  const monthKey = $("monthSelect").value;
  const att = getAttendance(monthKey);
  if(!att[playerId]) att[playerId] = {};
  if(att[playerId][iso]){ delete att[playerId][iso]; dot.classList.remove("on"); }
  else { att[playerId][iso] = true; dot.classList.add("on"); }
  setAttendance(monthKey, att);
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
  dAv.appendChild(avatarNode(p));

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
  const wrap = $("rosterList");
  wrap.innerHTML = "";
  for(const p of roster){
    const card = document.createElement("div");
    card.className = "player";
    // Foto come sfondo del riquadro (niente mini-avatar)
    const bgUrl = photoUrlForPlayerBg(p);
    if(bgUrl){
      card.classList.add("has-photo");
      card.style.setProperty("--player-bg", `url("${bgUrl}")`);
    }

    // Badge numero maglia
    const badge = document.createElement("div");
    badge.className = "num-badge card-badge" + ((p.number && String(p.number).trim()!=="") ? "" : " hidden");
    badge.textContent = (p.number && String(p.number).trim()!=="") ? String(p.number) : "";

    const mid = document.createElement("div");
    mid.style.flex="1";
    const nm=document.createElement("div");
    nm.className="name";
    // Nome su due righe (nome sopra, cognome sotto) per mobile
    const parts = String(p.name||"").trim().split(/\s+/);
    const first = parts.shift() || "";
    const last = parts.join(" ");
    nm.innerHTML = `<span class="first">${first}</span><span class="last">${last}</span>`;
    nm.addEventListener("click", ()=> openDetails(p.id));
    const sb=document.createElement("div");
    sb.className="sub";
    sb.textContent=""; sb.style.display="none";
    mid.appendChild(badge);
    mid.appendChild(nm);
    mid.appendChild(sb);

    const roles = document.createElement("div");
    roles.className="role-wrap";

    const s1=document.createElement("select");
    s1.innerHTML = roleOptions(p.role1||"");
    s1.addEventListener("change", ()=>{
      p.role1=s1.value;
      Storage.set("roster", roster);
      if(detailsPlayerId===p.id) refreshDetails();
      renderMatchDropdowns();
    });

    const s2=document.createElement("select");
    s2.innerHTML = roleOptions(p.role2||"");
    s2.addEventListener("change", ()=>{
      p.role2=s2.value;
      Storage.set("roster", roster);
      if(detailsPlayerId===p.id) refreshDetails();
      renderMatchDropdowns();
    });

    roles.appendChild(s1); roles.appendChild(s2);
    mid.appendChild(roles);

    // Numero maglia (richiesta: seleziono -> SALVO, e deve restare in grafica "più bella")
    const numBox=document.createElement("div");
    numBox.className="num-box";

    const numLabel=document.createElement("div");
    numLabel.className="sub";
    numLabel.textContent="Numero maglia";

    const numRow=document.createElement("div");
    numRow.className="num-row";

    const sel=document.createElement("select");
    sel.className="num-select";
    // vuoto + 1..99
    sel.innerHTML = [`<option value="">—</option>`].concat(
      Array.from({length:99},(_,i)=>{
        const v=String(i+1);
        return `<option value="${v}" ${String(p.number||"")===v?"selected":""}>${v}</option>`;
      })
    ).join("");

    let pending = String(p.number||"");
    sel.addEventListener("change", ()=>{ pending = sel.value; });

    const saveBtn=document.createElement("button");
    saveBtn.className="btn";
    saveBtn.type="button";
    saveBtn.textContent="Salva";
    saveBtn.addEventListener("click", ()=>{
      p.number = pending;
      Storage.set("roster", roster);
      // aggiorna badge
      const has = (p.number && String(p.number).trim()!=="");
      badge.textContent = has ? String(p.number) : "";
      badge.classList.toggle("hidden", !has);
      if(detailsPlayerId===p.id) refreshDetails();
      updateBoardTokenNumbers(p.id);
      renderBoardRoster();
    });

    numRow.appendChild(sel);
    numRow.appendChild(saveBtn);
    numBox.appendChild(numLabel);
    numBox.appendChild(numRow);
    mid.appendChild(numBox);

    // Azioni in basso (più compatto e meno spazio sprecato)
    const tools=document.createElement("div");
    tools.className="tools-bottom";

    const bPhoto=document.createElement("button");
    bPhoto.className="btn";
    bPhoto.textContent="Foto";
    bPhoto.type="button";
    bPhoto.addEventListener("click", ()=> pickPhotoFor(p.id));

    const bDel=document.createElement("button");
    bDel.className="btn danger";
    bDel.textContent="Rimuovi";
    bDel.type="button";
    bDel.addEventListener("click", ()=>{
      if(!confirm("Rimuovere questo giocatore?")) return;
      roster = roster.filter(x=>x.id!==p.id);
      Storage.set("roster", roster);
      if(detailsPlayerId===p.id) closeDetails();
      renderRoster(); renderAttendance(); renderMatchDropdowns(); renderBoardRoster();
    });

    tools.appendChild(bPhoto);
    tools.appendChild(bDel);

    mid.appendChild(tools);

    card.appendChild(mid);

    wrap.appendChild(card);
  }
}

// Add player modal
const modalPlayer = $("modalPlayer");
$("btnAddPlayer").addEventListener("click", ()=>{
  $("pName").value="";
  $("pPhoto").value="";
  modalPlayer.classList.remove("hidden");
});
$("btnPlayerCancel").addEventListener("click", ()=> modalPlayer.classList.add("hidden"));
modalPlayer.addEventListener("click",(e)=>{ if(e.target===modalPlayer) modalPlayer.classList.add("hidden"); });

$("btnPlayerSave").addEventListener("click", async ()=>{
  const name = $("pName").value.trim();
  if(!name){ alert("Inserisci Nome e Cognome."); return; }
  const p = { id: String(Date.now()), name, role1:"", role2:"", number:"" };
  const file = $("pPhoto").files?.[0];
  if(file) p.photoDataUrl = await Utils.fileToDataURL(file);
  roster.push(p);
  Storage.set("roster", roster);
  modalPlayer.classList.add("hidden");
  renderRoster(); renderAttendance(); renderMatchDropdowns(); renderBoardRoster();
});

async function pickPhotoFor(playerId){
  const p = roster.find(x=>x.id===playerId);
  if(!p) return;
  const input=document.createElement("input");
  input.type="file"; input.accept="image/*";
  input.onchange = async ()=>{
    const f=input.files?.[0];
    if(!f) return;
    p.photoDataUrl = await Utils.fileToDataURL(f);
    Storage.set("roster", roster);
    renderRoster(); renderAttendance(); renderMatchDropdowns(); renderBoardRoster();
    if(detailsPlayerId===playerId) refreshDetails();
  };
  input.click();
}


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

// Tattica
const fsWrap = $("fsWrap");
const pitch = $("pitch");
const tokens = $("tokens");
const ink = $("ink");
const ctx = ink.getContext("2d");
// --- Lavagna: tool state + helpers (v1.1.3) ---------------------------
let tool = "none";      // "none" | "pen" | "eraser"
let drawing = false;

function setTool(next){
  // toggle off when clicking the same tool again
  tool = (tool === next) ? "none" : next;
  const penBtn = document.getElementById("btnPen");
  const erBtn  = document.getElementById("btnEraser");
  if(penBtn) penBtn.classList.toggle("active", tool==="pen");
  if(erBtn)  erBtn.classList.toggle("active", tool==="eraser");

  // pen/eraser config
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if(tool==="pen"){
    ctx.strokeStyle = "rgba(255,255,255,.92)";
    ctx.lineWidth = 4;
  }else if(tool==="eraser"){
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.lineWidth = 22;
  }
}

function clearInk(){
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, ink.width/dpr, ink.height/dpr);
}

function resizeInk(){
  if(!ink || !pitch) return;
  const rect = pitch.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  // keep drawing when resizing
  const prev = document.createElement("canvas");
  prev.width = ink.width;
  prev.height = ink.height;
  const pctx = prev.getContext("2d");
  pctx.drawImage(ink, 0, 0);

  ink.width = Math.round(w * dpr);
  ink.height = Math.round(h * dpr);
  ink.style.width = w + "px";
  ink.style.height = h + "px";

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // restore previous
  try{
    ctx.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, w, h);
  }catch(_){}
}

function safeBoardResize(){
  try{ resizeInk(); }catch(_){}
  try{ clampTokens(); }catch(_){}
}

function isMobileBoard(){
  return window.matchMedia && window.matchMedia("(max-width: 860px)").matches;
}

function setRosterCollapsed(on){
  const o = document.getElementById("boardOverlay");
  if(!o) return;
  o.classList.toggle("roster-collapsed", !!on);
}

function ensureFixedBoardTokens(){
  if(!tokens || !pitch) return;
  tokens.innerHTML = "";

  const makeToken = (src, id, nx, ny) => {
    const t = document.createElement("div");
    t.className = "token jersey-token";
    t.dataset.id = id;
    const img = document.createElement("img");
    img.alt = "pedina";
    img.src = src;
    t.appendChild(img);
    tokens.appendChild(t);
    requestAnimationFrame(()=> setTokenPos(t, nx, ny));
    attachTokenDrag(t);
  };

  const red = "assets/jersey-red.png";
  const yellow = "assets/jersey-yellow.png";
  const xs = 0.06;
  const ys = [0.10,0.22,0.34,0.46,0.58,0.70];
  ys.forEach((y,i)=> makeToken(red, "R"+(i+1), xs, y));
  makeToken(yellow, "Y1", xs, 0.86);
}

// --- Drag pedine -------------------------------------------------------
function attachTokenDrag(tokenEl){
  let draggingLocal = false;

  const onDown = (e) => {
    if(tool !== "none") return; // durante penna/gomma non spostare
    draggingLocal = true;
    tokenEl.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const onMove = (e) => {
    if(!draggingLocal) return;
    const r = pitch.getBoundingClientRect();
    const tw = tokenEl.offsetWidth || 48;
    const th = tokenEl.offsetHeight || 48;
    const x = (e.clientX - r.left) - tw/2;
    const y = (e.clientY - r.top)  - th/2;
    const aw = Math.max(1, r.width - tw);
    const ah = Math.max(1, r.height - th);
    let nx = x / aw;
    let ny = y / ah;
    nx = Math.max(0, Math.min(1, nx));
    ny = Math.max(0, Math.min(1, ny));
    setTokenPos(tokenEl, nx, ny);
  };

  const onUp = () => { draggingLocal = false; };

  tokenEl.addEventListener("pointerdown", onDown, {passive:false});
  window.addEventListener("pointermove", onMove, {passive:false});
  window.addEventListener("pointerup", onUp);
}

// Buttons lavagna
const btnPen = document.getElementById("btnPen");
const btnEraser = document.getElementById("btnEraser");
const btnClearBoard = document.getElementById("btnClearBoard");
if(btnPen) btnPen.addEventListener("click", ()=> setTool("pen"));
if(btnEraser) btnEraser.addEventListener("click", ()=> setTool("eraser"));
if(btnClearBoard) btnClearBoard.addEventListener("click", ()=>{ clearInk(); setTool("none"); });

setTimeout(()=>{ try{ resizeInk(); }catch(_){ } }, 80);


// v6.2 — keep pitch full height after fullscreen / orientation changes (especially mobile)
document.addEventListener("fullscreenchange", ()=>{ setTimeout(safeBoardResize, 80); setTimeout(safeBoardResize, 260); });
window.addEventListener("orientationchange", ()=>{ setTimeout(safeBoardResize, 120); setTimeout(safeBoardResize, 420); });
if(window.visualViewport){
  window.visualViewport.addEventListener("resize", ()=>{ setTimeout(safeBoardResize, 60); });
}

// Modalità "presentazione" (pseudo-fullscreen) affidabile su mobile.
// Su Chrome mobile il fullscreen nativo può fallire in alcuni casi: qui garantiamo sempre
// un campo a schermo pieno e un tasto "Esci" che funziona.

function isPresentMode(){
  return document.body.classList.contains("present-mode");
}

// Nuova lavagna: overlay fullscreen (aperto da pulsante "Lavagna")
function isBoardOpen(){
  const o = document.getElementById("boardOverlay");
  return !!o && !o.classList.contains("hidden");
}

function openBoardOverlay(){
  const o = document.getElementById("boardOverlay");
  if(!o) return;
  o.classList.remove("hidden");
  o.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");

  // Lavagna pura: sempre a schermo intero con 7 pedine fisse (6 rosse + 1 gialla)
  ensureFixedBoardTokens();
  setTool("none");
  enterBoardFullscreen();
  setTimeout(()=>{ try{ resizeInk(); clampTokens(); }catch(_){ } }, 60);
}


async function closeBoardOverlay(){
  const o = document.getElementById("boardOverlay");
  if(!o) return;
  // esci da eventuale fullscreen nativo
  try{ if(document.fullscreenElement && document.exitFullscreen){ await document.exitFullscreen(); } }catch(_){ }
  o.classList.add("hidden");
  o.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
  o.classList.remove("roster-collapsed");
  setTool("none");
}

function enterPresentMode(){
  if(isPresentMode()) return;
  updateViewportVars();
  document.body.classList.add("present-mode");
  // evita scroll della pagina sotto
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  // ricalcola canvas e vincola token dopo il cambio layout
  setTimeout(()=>{ try{ resizeInk(); clampTokens(); }catch(_){ } }, 60);
}

function exitPresentMode(){
  if(!isPresentMode()) return;
  document.body.classList.remove("present-mode");
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
  setTimeout(()=>{ try{ resizeInk(); clampTokens(); }catch(_){ } }, 60);
}

async function requestNativeFullscreen(){
  try{
    const o = document.getElementById("boardOverlay");
    if(!o?.requestFullscreen) return false;
    await o.requestFullscreen();
    return !!document.fullscreenElement;
  }catch(_){
    return false;
  }
}

async function enterBoardFullscreen(){
  // Safari iOS: il fullscreen nativo è instabile. Usiamo sempre la present-mode (CSS fullscreen).
  setTool("none");
  enterPresentMode();
  // comprimi rosa per avere più campo
  try{ if(isMobileBoard()) setRosterCollapsed(true); }catch(_){}
  // ricalcolo dimensioni per evitare campo tagliato
  setTimeout(()=>{ updateViewportVars(); safeBoardResize(); }, 120);
  setTimeout(()=>{ updateViewportVars(); safeBoardResize(); }, 380);
}

async function exitBoardFullscreen(){
  // esce dal fullscreen nativo (se presente). L'overlay resta gestito da open/close.
  try{
    if(document.fullscreenElement && document.exitFullscreen){
      await document.exitFullscreen();
    }
  }catch(_){ }
}

function setTokenPos(tokenEl, nx, ny){
  const maxW = pitch.clientWidth;
  const maxH = pitch.clientHeight;
  const tw = tokenEl.offsetWidth || 48;
  const th = tokenEl.offsetHeight || 48;
  const aw = Math.max(0, maxW - tw);
  const ah = Math.max(0, maxH - th);
  const x = aw ? (nx * aw) : 0;
  const y = ah ? (ny * ah) : 0;
  tokenEl.dataset.nx = String(nx);
  tokenEl.dataset.ny = String(ny);
  tokenEl.style.left = "0px";
  tokenEl.style.top  = "0px";
  tokenEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

function clampTokens(){
  const maxW = pitch.clientWidth;
  const maxH = pitch.clientHeight;
  if(maxW < 20 || maxH < 20) return;
  tokens.querySelectorAll(".token").forEach(t=>{
    const tw = t.offsetWidth || 48;
    const th = t.offsetHeight || 48;
    const aw = Math.max(0, maxW - tw);
    const ah = Math.max(0, maxH - th);
    let nx = parseFloat(t.dataset.nx || "0.5");
    let ny = parseFloat(t.dataset.ny || "0.5");
    // clamp normalized
    nx = Math.max(0, Math.min(1, nx));
    ny = Math.max(0, Math.min(1, ny));
    const x = aw ? (nx * aw) : 0;
    const y = ah ? (ny * ah) : 0;
    t.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  });
}




// draw/erase
ink.addEventListener("pointerdown",(e)=>{
  if(!(tool==="pen" || tool==="eraser")) return;
  drawing=true;
  ink.setPointerCapture(e.pointerId);
  const r=ink.getBoundingClientRect();
  ctx.globalCompositeOperation = (tool==="eraser") ? "destination-out" : "source-over";
  ctx.beginPath();
  ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
});
ink.addEventListener("pointermove",(e)=>{
  if(!drawing) return;
  if(!(tool==="pen" || tool==="eraser")) return;
  const r=ink.getBoundingClientRect();
  ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
  ctx.stroke();
});
ink.addEventListener("pointerup", ()=> drawing=false);

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
        <div class="t">${m.opponent || "Avversario"}</div>
        <div class="s">${date} • ${score}</div>
        <div class="s">Capitano: ${capName} • Vice: ${viceName}</div>
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
      matches = matches.filter(x=>x.id!==m.id);
      Storage.set("matches", matches);
      renderMatches();
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
  matches.push(m);
  Storage.set("matches", matches);
  renderMatches();
  $("mDate").value=""; $("mOpponent").value=""; $("mQ1").value=""; $("mQ2").value=""; $("mQ3").value=""; $("mQ4").value="";
});
$("btnClearMatchForm").addEventListener("click", ()=>{
  $("mDate").value=""; $("mOpponent").value=""; $("mQ1").value=""; $("mQ2").value=""; $("mQ3").value=""; $("mQ4").value="";
});

// Print helpers
function setPrintHeader(contextLabel){
  const team = document.getElementById("printTeam");
  const meta = document.getElementById("printMeta");
  const ctxEl = document.getElementById("printContext");
  const logo = document.getElementById("printLogo");

  if(team) team.textContent = settings.teamName || "Gestione Squadra";
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
  const totalSessions = dates.length || 1;

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
    const pct = Math.round((count/totalSessions)*100);

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
  const totalSessions = dates.length || 1;
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
    const pct = Math.round((count/totalSessions)*100);

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
  setPrintHeader("Presenze — " + monthLabel + " (Lun • Mer • Gio)");
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
  $("sTeam").value = settings.teamName || "Gestione Squadra";
  const catSel = $("sCategory");
  catSel.innerHTML = CATEGORIES.map(c=>`<option value="${c}">${c||"—"}</option>`).join("");
  catSel.value = settings.category || "";
  $("sMister").value = settings.misterName || "";
  $("sVersion").value = settings.version || VERSION;
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
  settings.teamName = $("sTeam").value.trim() || "Gestione Squadra";
  settings.category = $("sCategory").value || "";
  settings.misterName = $("sMister").value.trim();
  settings.version = $("sVersion").value.trim() || VERSION;
  const file = $("sLogo").files?.[0];
  if(file) settings.logoDataUrl = await Utils.fileToDataURL(file);
  Storage.set("settings", settings);
  applyBrand();
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

// Print buttons
function printNow(which){ preparePrint(which); window.print(); }
$("btnPrintAttendance").addEventListener("click", ()=>printNow("presenze"));
$("btnAllPresent").addEventListener("click", ()=>{
  const monthKey = $("monthSelect").value;
  const att = getAttendance(monthKey);
  const iso = Storage.get("attSelectedDay:" + monthKey, "");
  if(!iso) return;
  for(const p of roster){ if(!att[p.id]) att[p.id] = {}; att[p.id][iso] = true; }
  setAttendance(monthKey, att);
  renderAttendance();
});

$("btnClearDay").addEventListener("click", ()=>{
  const monthKey = $("monthSelect").value;
  const att = getAttendance(monthKey);
  const iso = Storage.get("attSelectedDay:" + monthKey, "");
  if(!iso) return;
  for(const p of roster){
    if(!att[p.id]) continue;
    if(att[p.id][iso]) delete att[p.id][iso];
  }
  setAttendance(monthKey, att);
  renderAttendance();
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


(function(){
  try {
    if(!localStorage.getItem('att:2026-02')){
      localStorage.setItem('att:2026-02', JSON.stringify({"2": {"BATTAGLIA RICCARDO": 1, "BENMIMOUN AMIR": 1, "BENMIMOUN HEDI": 0, "BURIOLA ELIA": 0, "CASONATO CHRISTIAN": 1, "DE GIUSTI GIACOMO": 1, "GHIRARDO GABRIEL": 1, "GHIRARDO GIANMARIA": 1, "GUZ PATRICK": 1, "HALLULI LEON": 1, "MARKU OREST": 1, "SONEGO LEONARDO": 0, "ZULIANI EVAN": 0}, "3": {"BATTAGLIA RICCARDO": 1, "BENMIMOUN AMIR": 1, "BENMIMOUN HEDI": 0, "BURIOLA ELIA": 0, "CASONATO CHRISTIAN": 1, "DE GIUSTI GIACOMO": 1, "GHIRARDO GABRIEL": 1, "GHIRARDO GIANMARIA": 1, "GUZ PATRICK": 1, "HALLULI LEON": 1, "MARKU OREST": 1, "SONEGO LEONARDO": 0, "ZULIANI EVAN": 0}, "4": {"BATTAGLIA RICCARDO": 1, "BENMIMOUN AMIR": 1, "BENMIMOUN HEDI": 1, "BURIOLA ELIA": 1, "CASONATO CHRISTIAN": 1, "DE GIUSTI GIACOMO": 1, "GHIRARDO GABRIEL": 1, "GHIRARDO GIANMARIA": 1, "GUZ PATRICK": 1, "HALLULI LEON": 1, "MARKU OREST": 1, "SONEGO LEONARDO": 1, "ZULIANI EVAN": 1}, "9": {"BATTAGLIA RICCARDO": 0, "BENMIMOUN AMIR": 1, "BENMIMOUN HEDI": 1, "BURIOLA ELIA": 1, "CASONATO CHRISTIAN": 1, "DE GIUSTI GIACOMO": 1, "GHIRARDO GABRIEL": 1, "GHIRARDO GIANMARIA": 1, "GUZ PATRICK": 1, "HALLULI LEON": 1, "MARKU OREST": 1, "SONEGO LEONARDO": 1, "ZULIANI EVAN": 1}, "10": {"BATTAGLIA RICCARDO": 1, "BENMIMOUN AMIR": 1, "BENMIMOUN HEDI": 1, "BURIOLA ELIA": 1, "CASONATO CHRISTIAN": 1, "DE GIUSTI GIACOMO": 1, "GHIRARDO GABRIEL": 1, "GHIRARDO GIANMARIA": 1, "GUZ PATRICK": 1, "HALLULI LEON": 1, "MARKU OREST": 1, "SONEGO LEONARDO": 1, "ZULIANI EVAN": 1}, "11": {"BATTAGLIA RICCARDO": 1, "BENMIMOUN AMIR": 1, "BENMIMOUN HEDI": 1, "BURIOLA ELIA": 1, "CASONATO CHRISTIAN": 1, "DE GIUSTI GIACOMO": 1, "GHIRARDO GABRIEL": 1, "GHIRARDO GIANMARIA": 1, "GUZ PATRICK": 1, "HALLULI LEON": 1, "MARKU OREST": 1, "SONEGO LEONARDO": 1, "ZULIANI EVAN": 1}, "12": {"BATTAGLIA RICCARDO": 1, "BENMIMOUN AMIR": 1, "BENMIMOUN HEDI": 1, "BURIOLA ELIA": 1, "CASONATO CHRISTIAN": 1, "DE GIUSTI GIACOMO": 1, "GHIRARDO GABRIEL": 1, "GHIRARDO GIANMARIA": 1, "GUZ PATRICK": 1, "HALLULI LEON": 1, "MARKU OREST": 1, "SONEGO LEONARDO": 1, "ZULIANI EVAN": 1}}));
    }
    if(!localStorage.getItem('matches')){
      // nessun risultato preimpostato: i tempi restano vuoti finché li compili tu
      localStorage.setItem('matches', JSON.stringify([
        {"date": "2026-02-11", "opponent": "Orsago", "home": true, "played": false},
        {"date": "2026-02-18", "opponent": "Uniongaia", "home": true, "played": false},
        {"date": "2026-02-25", "opponent": "Vittsangiacomo", "home": false, "played": false},
        {"date": "2026-03-04", "opponent": "Cappella Magg.", "home": true, "played": false},
        {"date": "2026-03-11", "opponent": "Dinamis", "home": true, "played": false},
        {"date": "2026-03-18", "opponent": "San Fior", "home": false, "played": false},
        {"date": "2026-03-25", "opponent": "Godega", "home": true, "played": false},
        {"date": "2026-04-08", "opponent": "Orsago", "home": false, "played": false},
        {"date": "2026-04-15", "opponent": "Uniongaia", "home": false, "played": false}
      ]));
    }
  } catch(e){}
})();

// v1.1.0 — extra safeguard for Safari: keep board measured correctly
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden){ setTimeout(()=>{ updateViewportVars(); safeBoardResize(); }, 120); }});
