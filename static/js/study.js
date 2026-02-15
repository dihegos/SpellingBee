import { qs, showToast } from "./helpers.js";
import { loadProgress } from "./progress.js";

const toast = qs("#toast");
const list = qs("#list");
const mistakes = qs("#mistakes");

async function load(){
  const r = await fetch("/api/words");
  const data = await r.json();
  if(!r.ok){ showToast(toast, `Error (${r.status}): ${data.error||"Unknown"}`); return; }

  const username = localStorage.getItem("sb:lastUser") || "user";
  const prog = loadProgress(username, data.grade);

  // lista base
  list.innerHTML = "";
  data.words.slice(0, 30).forEach(w=>{
    const li = document.createElement("li");
    li.textContent = w;
    list.appendChild(li);
  });

  // errores top
  const wrongEntries = Object.entries(prog.wrong)
    .filter(([w,c]) => c > 0)
    .sort((a,b)=> b[1]-a[1])
    .slice(0, 20);

  mistakes.innerHTML = "";
  if(!wrongEntries.length){
    const li = document.createElement("li");
    li.textContent = "Aún no tienes errores guardados 🙂";
    mistakes.appendChild(li);
    return;
  }

  wrongEntries.forEach(([w,c])=>{
    const li = document.createElement("li");
    li.textContent = `${w} (errores: ${c})`;
    mistakes.appendChild(li);
  });
}
load();
