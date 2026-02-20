/* Gestione Squadra — Vista sola lettura (Presenze + Rosa) */

function $(id){ return document.getElementById(id); }

function b64urlDecode(b64url){
  const b64 = String(b64url||"").replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const str = atob(b64 + pad);
  return decodeURIComponent(escape(str));
}

function pad2(n){ return String(n).padStart(2, "0"); }
function monthKey(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`; }
function itMonth(i){ return ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"][i]; }
function itWdShort(d){ return ["Dom","Lun","Mar","Mer","Gio","Ven","Sab"][d]; }
function initials(full){
  const p=(full||"").trim().split(/\s+/).filter(Boolean);
  const a=p[0]?.[0]||""; const b=p[1]?.[0]||p[0]?.[1]||"";
  return (a+b).toUpperCase();
}

function escapeHtml(s){
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPayload(){
  const hash = (location.hash||"").replace(/^#/,"");
  if(!hash) return null;
  try{
    return JSON.parse(b64urlDecode(hash));
  }catch(_){
    return null;
  }
}

function buildMonthOptions(monthKeys){
  const sel = $("vMonthSelect");
  sel.innerHTML = "";
  const sorted = [...monthKeys].sort((a,b)=>b.localeCompare(a));
  for(const k of sorted){
    const [y,m] = k.split("-");
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = `${itMonth(parseInt(m,10)-1)} ${y}`;
    sel.appendChild(opt);
  }
  // default: ultimo mese disponibile o mese corrente
  const cur = monthKey(new Date());
  sel.value = monthKeys.includes(cur) ? cur : (sorted[0] || cur);
}

function buildSessionsForMonth(key){
  const [yS,mS] = key.split("-");
  const y = parseInt(yS,10);
  const m = parseInt(mS,10)-1;
  const d = new Date(y, m, 1);
  const dates = [];
  while(d.getMonth()===m){
    const wd = d.getDay();
    // Lun (1), Mer (3), Gio (4)
    if(wd===1 || wd===3 || wd===4){
      dates.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    }
    d.setDate(d.getDate()+1);
  }
  return dates;
}

function isoDate(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

function renderAttendance(payload){
  const monthSel = $("vMonthSelect");
  const key = monthSel.value;
  const att = (payload.attendance && payload.attendance[key]) ? payload.attendance[key] : {};
  const roster = payload.roster || [];

  const [yS,mS] = key.split("-");
  const monthLabel = `${itMonth(parseInt(mS,10)-1)} ${yS} (Lun • Mer • Gio)`;
  $("vMonthTitle").textContent = monthLabel;

  const dates = buildSessionsForMonth(key);
  const wrap = $("vAttendanceTable");
  wrap.innerHTML = "";

  const table = document.createElement("table");
  table.className = "att-horizontal";

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  const th0 = document.createElement("th");
  th0.textContent = "Giocatore";
  trh.appendChild(th0);

  for(const d of dates){
    const th = document.createElement("th");
    th.className = "day-head";
    th.innerHTML = `<div class="day">${escapeHtml(itWdShort(d.getDay()))}</div><div class="num">${escapeHtml(String(d.getDate()))}</div>`;
    trh.appendChild(th);
  }
  const thTot = document.createElement("th");
  thTot.textContent = "Tot";
  trh.appendChild(thTot);

  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for(const p of roster){
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.className = "name-cell";
    tdName.textContent = p.name || "—";
    tr.appendChild(tdName);

    let count = 0;
    for(const d of dates){
      const iso = isoDate(d);
      const on = !!(att?.[p.id]?.[iso]);
      if(on) count++;
      const td = document.createElement("td");
      const dot = document.createElement("div");
      dot.className = "dot" + (on ? " on" : "");
      dot.style.pointerEvents = "none";
      td.appendChild(dot);
      tr.appendChild(td);
    }

    const tdTot = document.createElement("td");
    tdTot.className = "tot-cell";
    tdTot.textContent = String(count);
    tr.appendChild(tdTot);

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  wrap.appendChild(table);

  // summary
  const totalSessions = dates.length || 1;
  const presentCount = roster.reduce((acc,p)=>{
    const c = Object.values(att?.[p.id]||{}).filter(Boolean).length;
    return acc + c;
  },0);
  const maxPossible = roster.length * totalSessions;
  const pct = maxPossible ? Math.round((presentCount/maxPossible)*100) : 0;
  $("vAttendanceSummary").innerHTML = `<div class="summary"><div class="summary-item"><div class="k">Sessioni</div><div class="v">${escapeHtml(String(totalSessions))}</div></div><div class="summary-item"><div class="k">Presenze totali</div><div class="v">${escapeHtml(String(presentCount))}</div></div><div class="summary-item"><div class="k">Copertura</div><div class="v">${escapeHtml(String(pct))}%</div></div></div>`;
}

function renderRoster(payload){
  const wrap = $("vRosterList");
  wrap.innerHTML = "";
  const roster = [...(payload.roster||[])].sort((a,b)=>(a.name||"").localeCompare(b.name||""));

  for(const p of roster){
    const card = document.createElement("div");
    card.className = "player";

    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.gap = "12px";
    top.style.alignItems = "center";

    const av = document.createElement("div");
    av.className = "avatar" + (p.photoDataUrl ? "" : " avatar-initials");
    av.style.width = "54px";
    av.style.height = "54px";
    av.style.borderRadius = "18px";
    av.style.overflow = "hidden";
    if(p.photoDataUrl){
      // Mostra immagine come nell'app (asset o dataURL)
      av.style.backgroundImage = `url('${String(p.photoDataUrl).replace(/'/g,"%27")}')`;
      av.style.backgroundSize = "cover";
      av.style.backgroundPosition = "center";
    }else{
      av.style.display = "grid";
      av.style.placeItems = "center";
      av.style.fontWeight = "1000";
      av.textContent = initials(p.name);
    }

    const badge = document.createElement("div");
    badge.className = "num-badge" + ((p.number && String(p.number).trim()!=="") ? "" : " hidden");
    badge.textContent = (p.number && String(p.number).trim()!=="") ? String(p.number) : "";

    const avWrap = document.createElement("div");
    avWrap.className = "avatar-wrap";
    avWrap.appendChild(av);
    avWrap.appendChild(badge);

    const mid = document.createElement("div");
    mid.style.flex = "1";

    const nm = document.createElement("div");
    nm.className = "name";
    nm.textContent = p.name || "—";

    const role = [p.role1, p.role2, p.role].filter(Boolean).join(" / ") || "—";
    const sb = document.createElement("div");
    sb.className = "sub";
    sb.textContent = role;

    mid.appendChild(nm);
    mid.appendChild(sb);

    top.appendChild(avWrap);
    top.appendChild(mid);

    card.appendChild(top);
    wrap.appendChild(card);
  }
}

function setTeam(payload){
  const t = payload.team || {};
  $("vTeamTitle").textContent = t.teamName || "Gestione Squadra";
  const sub = ["Sola lettura", t.category].filter(Boolean).join(" • ");
  $("vTeamSub").textContent = sub;
}

function setupNav(){
  const pages = {
    presenze: $("v-presenze"),
    rosa: $("v-rosa")
  };
  const btns = Array.from(document.querySelectorAll(".nav .nav-item"));
  function go(tab){
    for(const [k,el] of Object.entries(pages)){
      el.classList.toggle("hidden", k!==tab);
    }
    for(const b of btns){
      b.classList.toggle("active", b.dataset.tab===tab);
    }
  }
  btns.forEach(b=>b.addEventListener("click", ()=>go(b.dataset.tab)));
}

(function init(){
  const payload = getPayload();
  if(!payload){
    document.body.innerHTML = '<div style="padding:18px;font-family:system-ui;color:#fff">Link non valido o dati mancanti.</div>';
    return;
  }

  setTeam(payload);

  const monthKeys = Object.keys(payload.attendance || {});
  buildMonthOptions(monthKeys.length ? monthKeys : [monthKey(new Date())]);

  $("vMonthSelect").addEventListener("change", ()=>renderAttendance(payload));

  renderAttendance(payload);
  renderRoster(payload);
  setupNav();
})();
