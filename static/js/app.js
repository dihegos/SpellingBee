import { qs, showToast } from "./helpers.js";
import { loadProgress, masteredCount, mistakesCount, getLast7DaysXP } from "./progress.js";

const toast = qs("#toast");

const kLevel = qs("#kLevel");
const kXP = qs("#kXP");
const kStreak = qs("#kStreak");
const kBestStreak = qs("#kBestStreak");

const kMastered = qs("#kMastered");
const kMistakes = qs("#kMistakes");
const kTotalWords = qs("#kTotalWords");

const firstWords = qs("#firstWords");

const streakCalendar = qs("#streakCalendar");
const xpBars = qs("#xpBars");
const badgesGrid = qs("#badgesGrid");

const courseBar = qs("#courseBar");
const coursePct = qs("#coursePct");

function weekdayShort(dateKey){
  // dateKey: YYYY-MM-DD
  const d = new Date(dateKey + "T00:00:00");
  return ["D","L","M","M","J","V","S"][d.getDay()];
}

function isToday(dateKey){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}` === dateKey;
}

function renderBadges(prog){
  const badges = prog.badges || {};
  const list = [
    {id:"first10", title:"First 10", desc:"10 aciertos", icon:"🎖️"},
    {id:"streak3", title:"Streak 3", desc:"3 días seguidos", icon:"🔥"},
    {id:"master20", title:"Master 20", desc:"20 dominadas", icon:"🍯"},
  ];

  badgesGrid.innerHTML = list.map(b=>{
    const on = !!badges[b.id];
    return `
      <div class="badgeCard ${on ? "" : "off"}">
        <div class="t">${b.icon} ${b.title}</div>
        <div class="mini">${b.desc}</div>
      </div>
    `;
  }).join("");
}

function renderCalendar(xpWeek){
  // xpWeek: [{dayKey,xp} ... 7 items]
  streakCalendar.innerHTML = "";
  xpWeek.forEach(({dayKey, xp})=>{
    const div = document.createElement("div");
    div.className = "day";
    if(xp > 0) div.classList.add("on");
    if(isToday(dayKey)) div.classList.add("today");
    div.innerHTML = `
      <div class="d1">${weekdayShort(dayKey)}</div>
      <div class="d2">${xp}</div>
    `;
    streakCalendar.appendChild(div);
  });
}

function renderXPBars(xpWeek){
  const max = Math.max(10, ...xpWeek.map(x=>x.xp)); // evita barras invisibles
  xpBars.innerHTML = "";
  xpWeek.forEach(({dayKey, xp})=>{
    const wrap = document.createElement("div");
    wrap.style.flex = "1";
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("div");
    fill.className = "barFill";
    fill.style.height = `${Math.round((xp/max)*100)}%`;
    bar.appendChild(fill);

    const label = document.createElement("div");
    label.className = "barLabel";
    label.textContent = weekdayShort(dayKey);

    wrap.appendChild(bar);
    wrap.appendChild(label);
    xpBars.appendChild(wrap);
  });
}

async function loadDashboard(){
  const res = await fetch("/api/words");
  const data = await res.json();

  if(!res.ok){
    if(toast) showToast(toast, `Error (${res.status}): ${data.error || "Unknown"}`);
    return;
  }

  const username = localStorage.getItem("sb:lastUser") || "user";
  const grade = data.grade;
  const words = data.words || [];

  const prog = loadProgress(username, grade);

  // KPIs
  kLevel.textContent = String(prog.level || 1);
  kXP.textContent = String(prog.xp || 0);
  kStreak.textContent = String(prog.streak?.count || 0);
  kBestStreak.textContent = String(prog.bestStreak || 0);

  // Course stats
  const mastered = masteredCount(prog);
  const mistakes = mistakesCount(prog);
  const total = words.length;

  kMastered.textContent = String(mastered);
  kMistakes.textContent = String(mistakes);
  kTotalWords.textContent = String(total);

  const pct = total ? Math.round((mastered/total)*100) : 0;
  courseBar.style.width = `${pct}%`;
  coursePct.textContent = `${pct}%`;

  firstWords.textContent = words.slice(0, 12).join(", ");

  // Week data (XP per day)
  const xpWeek = getLast7DaysXP(prog);
  renderCalendar(xpWeek);
  renderXPBars(xpWeek);

  // Badges
  renderBadges(prog);
}

loadDashboard();

// Logout
const logoutBtn = qs("#logoutBtn");
if(logoutBtn){
  logoutBtn.addEventListener("click", async ()=>{
    await fetch("/auth/logout", {method:"POST"});
    location.href = "/";
  });
}
