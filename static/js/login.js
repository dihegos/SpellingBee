import { postJSON, qs, showToast } from "./helpers.js";

const form = qs("#loginForm");
const toast = qs("#toast");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  toast.style.display = "none";

  const payload = {
    username: qs("#username").value.trim(),
    password: qs("#password").value
  };

  const r = await postJSON("/auth/login", payload);
  if(!r.ok){
    showToast(toast, `Error (${r.status}): ${r.data.error || "Unknown"}`);
    return;
  }
  if(!r.data.active){
    showToast(toast, "Cuenta creada pero aún inactiva (pago pendiente). Usa invitado para pruebas locales.");
    return;
  }

  localStorage.setItem("sb:lastUser", payload.username.trim().toLowerCase());
  location.href = r.data.next || "/app";
});
