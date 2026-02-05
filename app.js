/* Gestione Squadra - v1.2.02 (stabile) */
const VERSION = "1.2.07";

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

const Utils = {
  pad2(n){ return String(n).padStart(2,"0"); },
  monthKey(d){ return `${d.getFullYear()}-${Utils.pad2(d.getMonth()+1)}`; },
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

const $ = (id)=>document.getElementById(id);

function roleOptions(selected){
  return ROLES.map(r=>`<option value="${r}" ${r===selected?"selected":""}>${r||"—"}</option>`).join("");
}

function fileKeyFor(id){ return id==="guz" ? "13" : id; }

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

// Default data
const DEFAULT_ROSTER = [
  { id:"1",  name:"BATTAGLIA RICCARDO", role1:"", role2:"", number:"" },
  { id:"5",  name:"BENMIMOUN AMIR", role1:"", role2:"", number:"" },
  { id:"9",  name:"BENMIMOUN HEDI", role1:"", role2:"", number:"" },
  { id:"11", name:"BURIOLA ELIA", role1:"", role2:"", number:"" },
  { id:"7",  name:"CASONATO CHRISTIAN", role1:"", role2:"", number:"" },
  { id:"8",  name:"DE GIUSTI GIACOMO", role1:"", role2:"", number:"" },
  { id:"4",  name:"GHIRARDO GABRIEL", role1:"", role2:"", number:"" },
  { id:"6",  name:"GHIRARDO GIANMARIA", role1:"", role2:"", number:"" },
  { id:"guz",name:"GUZ PATRICK", role1:"", role2:"", number:"" },
  { id:"12", name:"HALLULLI LEON", role1:"", role2:"", number:"" },
  { id:"3",  name:"MARKU OREST", role1:"", role2:"", number:"" },
  { id:"10", name:"SONEGO LEONARDO", role1:"", role2:"", number:"" },
  { id:"2",  name:"ZULIANI EVAN", role1:"", role2:"", number:"" },
];

const DEFAULT_SETTINGS = { version: VERSION, teamName:"Gestione Squadra", category:"", misterName:"", logoDataUrl:"" };

let settings = Storage.get("settings", DEFAULT_SETTINGS);
let roster = Storage.get("roster", null) || DEFAULT_ROSTER;
let matches = Storage.get("matches", []);

function getAttendance(key){ return Storage.get("att:"+key, {}); }
function setAttendance(key, data){ Storage.set("att:"+key, data); }

// Navigation
const pages = {
  presenze: $("page-presenze"),
  rosa: $("page-rosa"),
  tattica: $("page-tattica"),
  partite: $("page-partite"),
};
document.querySelectorAll(".nav-item").forEach(btn=>{
  btn.addEventListener("click", ()=> setTab(btn.dataset.tab));
});

function setTab(tab){
  document.querySelectorAll(".nav-item").forEach(b=> b.classList.toggle("active", b.dataset.tab===tab));
  Object.entries(pages).forEach(([k,el])=> el.classList.toggle("hidden", k!==tab));
  if(tab==="presenze") renderAttendance();
  if(tab==="rosa") renderRoster();
  if(tab==="tattica"){ renderBoardRoster(); resizeInk(); }
  if(tab==="partite"){ renderMatchDropdowns(); renderMatches(); }
}

// Branding
function applyBrand(){
  $("teamTitle").textContent = settings.teamName || "Gestione Squadra";
  const parts = [];
  parts.push("v" + (settings.version||VERSION));
  if(settings.category) parts.push(settings.category);
  if(settings.misterName) parts.push("Mister: " + settings.misterName);
  $("brandSub").textContent = parts.join(" • ");

  // Logo squadra
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
  const now = new Date();
  const years = [now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1];
  for(const y of years){
    for(let m=1;m<=12;m++){
      const key = `${y}-${Utils.pad2(m)}`;
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = `${Utils.itMonth(m-1)} ${y}`;
      sel.appendChild(opt);
    }
  }
  sel.value = Storage.get("attSelectedMonth", Utils.monthKey(new Date()));
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
  const att = getAttendance(monthKey);
  for(const p of roster){ if(!att[p.id]) att[p.id] = {}; }

  const wrap = $("attendanceTable");
  wrap.innerHTML = "";
  const table = document.createElement("table");

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  const th0 = document.createElement("th");
  th0.textContent = "Giocatore";
  hr.appendChild(th0);
  for(const d of dates){
    const th=document.createElement("th");
    th.textContent = `${Utils.itWdShort(d.wd)} ${d.day}`;
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for(const p of roster){
    const tr = document.createElement("tr");
    tr.dataset.player = p.id;

    const td0 = document.createElement("td");
    const cell = document.createElement("div");
    cell.className = "player-cell";
    cell.appendChild(avatarNode(p));
    const name = document.createElement("div");
    name.textContent = p.name;
    cell.appendChild(name);
    td0.appendChild(cell);
    tr.appendChild(td0);

    for(const d of dates){
      const td=document.createElement("td");
      const dot=document.createElement("span");
      dot.className = "dot" + (att[p.id][d.iso] ? " on" : "");
      dot.dataset.date = d.iso;
      td.appendChild(dot);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);

  setAttendance(monthKey, att);
  updateNextCards();
}

$("attendanceTable").addEventListener("click", (e)=>{
  const dot = e.target.closest(".dot");
  if(!dot) return;
  const tr = dot.closest("tr");
  const playerId = tr?.dataset.player;
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
  $("dId").textContent = "ID: " + p.id;

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
    card.className = "roster-card";

    const avatarWrap = document.createElement("div");
    avatarWrap.style.cursor="pointer";
    avatarWrap.appendChild(avatarNode(p));
    avatarWrap.addEventListener("click", ()=> openDetails(p.id));
    card.appendChild(avatarWrap);

    const mid = document.createElement("div");
    mid.style.flex="1";
    const nm=document.createElement("div");
    nm.className="name";
    nm.textContent=p.name;
    const sb=document.createElement("div");
    sb.className="sub";
    sb.textContent="ID: " + p.id;
    mid.appendChild(nm); mid.appendChild(sb);

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

    // Numero maglia
    const numLabel=document.createElement("div");
    numLabel.className="sub";
    numLabel.style.marginTop="8px";
    numLabel.textContent="Numero maglia";
    const num=document.createElement("input");
    num.className="num";
    num.type="number";
    num.min="0"; num.max="999";
    num.placeholder="Es. 10";
    num.value=p.number || "";
    num.addEventListener("input", ()=>{
      p.number = num.value;
      Storage.set("roster", roster);
      if(detailsPlayerId===p.id) refreshDetails();
    });
    mid.appendChild(numLabel);
    mid.appendChild(num);

    card.appendChild(mid);

    const tools=document.createElement("div");
    tools.className="tools";

    const bPhoto=document.createElement("button");
    bPhoto.className="small";
    bPhoto.textContent="Foto";
    bPhoto.type="button";
    bPhoto.addEventListener("click", ()=> pickPhotoFor(p.id));

    const bDel=document.createElement("button");
    bDel.className="small danger";
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
    card.appendChild(tools);

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

// Tattica
const pitch = $("pitch");
const tokens = $("tokens");
const ink = $("ink");
const ctx = ink.getContext("2d");

let tool = "none"; // none | pen | eraser
let drawing = false;

function setTool(mode){
  // toggle off if same button pressed
  if(tool === mode) tool = "none";
  else tool = mode;

  const drawOn = (tool==="pen" || tool==="eraser");
  document.body.classList.toggle("draw", drawOn);
  ink.style.pointerEvents = drawOn ? "auto" : "none";

  // button states
  $("btnPen").classList.toggle("ghost", tool!=="pen");
  $("btnEraser").classList.toggle("ghost", tool!=="eraser");
}
$("btnPen").addEventListener("click", ()=> setTool("pen"));
$("btnEraser").addEventListener("click", ()=> setTool("eraser"));

$("btnClearBoard").addEventListener("click", ()=>{
  ctx.clearRect(0,0,ink.width,ink.height);
  tokens.querySelectorAll(".token").forEach(t=>t.remove());
});

function resizeInk(){
  const r = pitch.getBoundingClientRect();
  ink.width = Math.floor(r.width * devicePixelRatio);
  ink.height = Math.floor(r.height * devicePixelRatio);
  ink.style.width = r.width + "px";
  ink.style.height = r.height + "px";
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  // PENNA BLU
  ctx.strokeStyle = "rgba(40,120,255,.95)";
  ink.style.pointerEvents = (tool==="pen" || tool==="eraser") ? "auto" : "none";
}
window.addEventListener("resize", ()=>{
  if(!pages.tattica.classList.contains("hidden")) resizeInk();
});

function renderBoardRoster(){
  const wrap = $("boardRoster");
  wrap.innerHTML = "";
  for(const p of roster){
    const chip=document.createElement("div");
    chip.className="chip";
    chip.appendChild(avatarNode(p));
    chip.addEventListener("click", ()=> addToken(p.id));
    wrap.appendChild(chip);
  }
}

function addToken(playerId){
  const p = roster.find(x=>x.id===playerId);
  if(!p) return;

  const tokenEl=document.createElement("div");
  tokenEl.className="token";

  tokenEl.appendChild(avatarNode(p));

  tokens.appendChild(tokenEl);

  const pr=tokens.getBoundingClientRect();
  tokenEl.style.left = Math.max(12, pr.width*0.5 - 30) + "px";
  tokenEl.style.top  = Math.max(12, pr.height*0.5 - 20) + "px";

  let startX=0,startY=0,origX=0,origY=0,dragging=false;
  tokenEl.addEventListener("pointerdown",(e)=>{
    if(tool!=="none") return;
    dragging=true;
    tokenEl.setPointerCapture(e.pointerId);
    startX=e.clientX; startY=e.clientY;
    origX=parseFloat(tokenEl.style.left)||0;
    origY=parseFloat(tokenEl.style.top)||0;
  });
  tokenEl.addEventListener("pointermove",(e)=>{
    if(!dragging) return;
    const dx=e.clientX-startX, dy=e.clientY-startY;
    tokenEl.style.left=(origX+dx)+"px";
    tokenEl.style.top=(origY+dy)+"px";
  });
  tokenEl.addEventListener("pointerup", ()=> dragging=false);
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

// Settings modal
const modalSettings = $("modalSettings");
$("btnSettings").addEventListener("click", ()=>{
  $("sTeam").value = settings.teamName || "Gestione Squadra";
  $("sMister").value = settings.misterName || "";
  // Categoria
  const catSel = $("sCategory");
  if(catSel){
    catSel.innerHTML = CATEGORIES.map(c=>`<option value="${c}">${c||"—"}</option>`).join("");
    catSel.value = settings.category || "";
  }
  $("sVersion").value = settings.version || VERSION;
  $("sLogo").value = "";
  modalSettings.classList.remove("hidden");
});
$("btnSettingsCancel").addEventListener("click", ()=> modalSettings.classList.add("hidden"));
modalSettings.addEventListener("click",(e)=>{ if(e.target===modalSettings) modalSettings.classList.add("hidden"); });

$("btnSettingsSave").addEventListener("click", async ()=>{
  settings.teamName = $("sTeam").value.trim() || "Gestione Squadra";
  settings.category = ($("sCategory") ? $("sCategory").value : "") || "";
  settings.misterName = $("sMister").value.trim();
  settings.version = $("sVersion").value.trim() || VERSION;
  const file = $("sLogo").files?.[0];
  if(file) settings.logoDataUrl = await Utils.fileToDataURL(file);
  Storage.set("settings", settings);
  applyBrand();
  modalSettings.classList.add("hidden");
});


function setPrintHeader(contextLabel){
  const team = document.getElementById("printTeam");
  const meta = document.getElementById("printMeta");
  const ctx = document.getElementById("printContext");
  const logo = document.getElementById("printLogo");

  if(team) team.textContent = settings.teamName || "Gestione Squadra";
  const parts = [];
  if(settings.category) parts.push(settings.category);
  if(settings.misterName) parts.push("Mister: " + settings.misterName);
  parts.push("Versione: " + (settings.version||VERSION));
  if(meta) meta.textContent = parts.join(" • ");

  if(ctx) ctx.textContent = contextLabel || "";

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

function preparePrint(which){
  if(which==="presenze"){
    buildAttendanceSummary();
  }else if(which==="rosa"){
    setPrintHeader("Rosa");
  }else if(which==="tattica"){
    setPrintHeader("Lavagna tattica");
  }else if(which==="partite"){
    setPrintHeader("Report partite");
  }else{
    setPrintHeader("");
  }
}

// Print buttons
function printNow(which){ preparePrint(which); window.print(); }
$("btnPrintAttendance").addEventListener("click", ()=>printNow("presenze"));
$("btnPrintRoster").addEventListener("click", ()=>printNow("rosa"));
$("btnPrintBoard").addEventListener("click", ()=>printNow("tattica"));
$("btnPrintMatches").addEventListener("click", ()=>printNow("partite"));

// Boot
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
