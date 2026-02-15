export async function postJSON(url, data){
  const res = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(data)});
  const txt = await res.text();
  let json;
  try{ json = JSON.parse(txt); }catch(e){ json = {raw: txt}; }
  return {ok: res.ok, status: res.status, data: json};
}
export function qs(sel){ return document.querySelector(sel); }
export function showToast(el, msg){
  el.textContent = msg;
  el.style.display = "block";
}
