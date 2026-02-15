import { qs, showToast } from "./helpers.js";

const toast = qs("#toast");
const grid = qs("#grid");
const search = qs("#search");
const count = qs("#count");
const saySlowBtn = qs("#saySlow");
const sayNormalBtn = qs("#sayNormal");

let words = [];
let rate = 1;

// Safari/macOS TTS FIX (igual que quest)
let cachedVoice = null;
function pickEnglishVoice(){
  const voices = speechSynthesis.getVoices() || [];
  return voices.find(v => /en-US/i.test(v.lang)) ||
         voices.find(v => /^en/i.test(v.lang)) ||
         voices[0] || null;
}
speechSynthesis.onvoiceschanged = () => { cachedVoice = pickEnglishVoice(); };

function speak(text){
  if(!cachedVoice) cachedVoice = pickEnglishVoice();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  if(cachedVoice) u.voice = cachedVoice;
  u.rate = rate;
  speechSynthesis.cancel();
  setTimeout(()=>speechSynthesis.speak(u), 30);
}

function render(list){
  grid.innerHTML = "";
  count.textContent = `${list.length} palabras`;

  list.forEach(w=>{
    const btn = document.createElement("button");
    btn.className = "btn bigBtn";
    btn.style.width = "100%";
    btn.style.justifyContent = "space-between";
    btn.innerHTML = `<span style="font-weight:900">${w}</span><span class="small">tap</span>`;
    btn.addEventListener("click", ()=>{
      showToast(toast, `🔊 ${w}`);
      speak(w);
    });
    grid.appendChild(btn);
  });
}

function filter(){
  const q = (search.value || "").trim().toLowerCase();
  if(!q) return render(words);
  render(words.filter(w => w.toLowerCase().includes(q)));
}

saySlowBtn.addEventListener("click", ()=>{
  rate = 0.60;
  showToast(toast, "🐢 Slow ON");
});

sayNormalBtn.addEventListener("click", ()=>{
  rate = 1;
  showToast(toast, "🔊 Normal ON");
});

search.addEventListener("input", filter);

(async ()=>{
  const res = await fetch("/api/words");
  const data = await res.json();
  if(!res.ok){
    showToast(toast, `Error (${res.status}): ${data.error || "Unknown"}`);
    return;
  }
  words = data.words || [];
  render(words);
})();
