import { postJSON, qs, showToast } from "./helpers.js";

const form = qs("#signupForm");
const toast = qs("#toast");
const guestBox = qs("#is_guest");
const guestWrap = qs("#guestWrap");

guestBox.addEventListener("change", () => {
  guestWrap.style.display = guestBox.checked ? "block" : "none";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  toast.style.display = "none";

  const payload = {
    first_name: qs("#first_name").value.trim(),
    last_name: qs("#last_name").value.trim(),
    grade: parseInt(qs("#grade").value, 10),
    username: qs("#username").value.trim(),
    password: qs("#password").value,
    is_guest: guestBox.checked,
    guest_code: qs("#guest_code").value.trim()
  };

  const r = await postJSON("/auth/signup", payload);
  if(!r.ok){
    showToast(toast, `Error (${r.status}): ${r.data.error || "Unknown"}`);
    return;
  }

  if(payload.is_guest){
    showToast(toast, "✅ Invitado creado. Ahora inicia sesión.");
    setTimeout(()=> location.href = "/login", 700);
    return;
  }

  const r2 = await postJSON("/billing/create-checkout-session", { username: payload.username });
  if(!r2.ok){
    showToast(toast, `⚠️ ${r2.data.error || "Stripe error"} — Usa modo invitado para pruebas locales.`);
    return;
  }
  location.href = r2.data.url;
});
