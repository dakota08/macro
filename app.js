const DEFAULT_GOALS = { protein: 190, carbs: 500, fat: 63 };
const $ = (id) => document.getElementById(id);
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const load = (key, fallback) => {
  try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
  catch { return fallback; }
};
let goals = load("macrotrack-goals", DEFAULT_GOALS);
let day = load("macrotrack-day", { date: todayKey(), entries: [] });
if (day.date !== todayKey()) day = { date: todayKey(), entries: [] };

const names = { protein: "Protein", carbs: "Carbs", fat: "Fat" };
const totals = () => day.entries.reduce((sum, entry) => {
  for (const key of Object.keys(names)) sum[key] += entry[key] || 0;
  return sum;
}, { protein: 0, carbs: 0, fat: 0 });
const save = () => {
  localStorage.setItem("macrotrack-goals", JSON.stringify(goals));
  localStorage.setItem("macrotrack-day", JSON.stringify(day));
};
const fmt = (n) => Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");

function render() {
  const t = totals();
  for (const key of Object.keys(names)) {
    const remaining = goals[key] - t[key];
    $(`${key}Remaining`).textContent = `${fmt(remaining)}${remaining < 0 ? "!" : ""}`;
    $(`${key}Consumed`).textContent = fmt(t[key]);
    $(`${key}Goal`).textContent = fmt(goals[key]);
    $(`${key}Bar`).style.width = `${Math.min(100, Math.max(0, goals[key] ? t[key] / goals[key] * 100 : 0))}%`;
  }
  $("todayLabel").textContent = new Date().toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric" });
  $("undoBtn").disabled = day.entries.length === 0;
  const list = $("historyList");
  list.replaceChildren();
  if (!day.entries.length) {
    const li = document.createElement("li"); li.className = "empty-state"; li.textContent = "Your entries will appear here."; list.append(li);
  } else {
    [...day.entries].reverse().forEach((entry) => {
      const li = document.createElement("li");
      const left = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = entry.label;
      const detail = document.createElement("span");
      detail.className = "entry-detail";
      detail.textContent = Object.keys(names).filter(k => entry[k]).map(k => `${fmt(entry[k])}g ${names[k].toLowerCase()}`).join(" · ");
      left.append(title, detail);
      const time = document.createElement("span"); time.className = "entry-time"; time.textContent = entry.time;
      li.append(left, time); list.append(li);
    });
  }
}
function parseEntry(raw) {
  const text = raw.toLowerCase().replace(/,/g, " ");
  const result = { protein: 0, carbs: 0, fat: 0 };
  const patterns = {
    protein: /(-?\d+(?:\.\d+)?)\s*(?:g\s*)?(?:protein|prot)\b/g,
    carbs: /(-?\d+(?:\.\d+)?)\s*(?:g\s*)?(?:carbs?|carbohydrates?)\b/g,
    fat: /(-?\d+(?:\.\d+)?)\s*(?:g\s*)?(?:fat)\b/g
  };
  let found = false;
  for (const key of Object.keys(patterns)) {
    for (const match of text.matchAll(patterns[key])) {
      // Entries represent consumed amounts. A leading minus is accepted as shorthand.
      result[key] += Math.abs(Number(match[1]));
      found = true;
    }
  }
  return found ? result : null;
}
$("entryForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const raw = $("entryInput").value.trim();
  const parsed = parseEntry(raw);
  const message = $("entryMessage");
  message.classList.remove("error");
  if (!parsed || !Object.values(parsed).some(v => v > 0)) {
    message.textContent = "I couldn't find a macro amount. Try “90 carbs, 35 protein”.";
    message.classList.add("error"); return;
  }
  const parts = Object.keys(names).filter(k => parsed[k]).map(k => `${fmt(parsed[k])}g ${names[k].toLowerCase()}`);
  day.entries.push({ ...parsed, label: parts.join(" + "), time: new Date().toLocaleTimeString([], {hour:"numeric", minute:"2-digit"}) });
  save(); render(); $("entryInput").value = "";
  message.textContent = `Added ${parts.join(", ")}.`;
});
$("undoBtn").addEventListener("click", () => {
  if (!day.entries.length) return;
  day.entries.pop(); save(); render(); $("entryMessage").textContent = "Last entry undone.";
});
const settings = $("settingsDialog");
$("settingsBtn").addEventListener("click", () => {
  $("goalProtein").value = goals.protein; $("goalCarbs").value = goals.carbs; $("goalFat").value = goals.fat;
  settings.showModal();
});
$("closeSettings").addEventListener("click", () => settings.close());
$("cancelSettings").addEventListener("click", () => settings.close());
$("settingsForm").addEventListener("submit", () => {
  goals = { protein: Number($("goalProtein").value), carbs: Number($("goalCarbs").value), fat: Number($("goalFat").value) };
  save(); render(); $("entryMessage").textContent = "Daily goals saved.";
});
const resetDialog = $("resetDialog");
$("resetBtn").addEventListener("click", () => resetDialog.showModal());
$("confirmReset").addEventListener("click", () => {
  day = { date: todayKey(), entries: [] }; save(); render(); $("entryMessage").textContent = "Today's entries have been reset.";
});
save(); render();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
