/* ==============================
   Coalition Tech Patient Dashboard (Jessica Taylor)
   ============================== */

const API_BASE = "https://fedskillstest.coalitiontechnologies.workers.dev";
const USERNAME = "coalition";
const PASSWORD = "skills-test";

// Helpers
const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
};

async function fetchPatients() {
  const auth = "Basic " + btoa(`${USERNAME}:${PASSWORD}`);
  const res = await fetch(API_BASE, { headers: { Authorization: auth } });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function findJessica(patients) {
  return patients.find((p) => (p.name || "").toLowerCase() === "jessica taylor");
}

function formatDOB(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function setVitals(latest) {
  if (!latest) return;
  $("#heartRateValue").textContent = latest.heart_rate?.value ?? "—";
  $("#respRateValue").textContent = latest.respiratory_rate?.value ?? "—";
  $("#tempValue").textContent = latest.temperature?.value ?? "—";

  const setLevel = (id, levels) => {
    const node = $(id);
    node.textContent = levels || "—";
    node.classList.remove("good", "warn", "bad");
    if (!levels) return;
    const l = levels.toLowerCase();
    if (l.includes("normal")) node.classList.add("good");
    else if (l.includes("higher")) node.classList.add("warn");
    else if (l.includes("lower")) node.classList.add("warn");
    else if (l.includes("critical") || l.includes("high")) node.classList.add("bad");
  };

  setLevel("#heartRateLevel", latest.heart_rate?.levels);
  setLevel("#respRateLevel", latest.respiratory_rate?.levels);
  setLevel("#tempLevel", latest.temperature?.levels);
}

function renderDxHistory(history = []) {
  const list = $("#dxHistory");
  list.innerHTML = "";
  // Show most recent first
  history
    .slice()
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    .forEach((h) => {
      const li = el("li");
      const title = `${h.month || ""} ${h.year || ""}`.trim();
      const bpS = h.blood_pressure?.systolic?.value;
      const bpD = h.blood_pressure?.diastolic?.value;
      li.innerHTML = `
        <div><strong>${title || "—"}</strong></div>
        <div class="subtle">BP: ${bpS ?? "—"}/${bpD ?? "—"} • HR: ${h.heart_rate?.value ?? "—"} • Temp: ${h.temperature?.value ?? "—"}°F</div>
      `;
      list.appendChild(li);
    });
}

function renderDxList(items = []) {
  const list = $("#dxList");
  list.innerHTML = "";
  items.forEach((d) => {
    const li = el("li");
    const status = (d.status || "").toLowerCase().replace(/\s+/g, "");
    li.innerHTML = `
      <div>
        <div><strong>${d.name || "—"}</strong></div>
        <div class="subtle">${d.description || ""}</div>
      </div>
      <span class="status ${status.includes("observation") ? "observation" : status.includes("treated") ? "treated" : status.includes("critical") ? "critical" : ""}">
        ${d.status || "—"}
      </span>
    `;
    list.appendChild(li);
  });
}

function renderLabResults(results = []) {
  const list = $("#labResults");
  list.innerHTML = "";
  results.forEach((name) => {
    const li = el("li");
    li.innerHTML = `<span class="file-pill">📄</span><span>${name}</span>`;
    list.appendChild(li);
  });
}

let bpChart;
function renderBPChart(history = []) {
  const ctx = document.getElementById("bpChart");
  const yearMap = new Map();

  // Aggregate by year (if API returns multiple months)
  history.forEach((h) => {
    if (!h?.year) return;
    const y = h.year;
    const s = h.blood_pressure?.systolic?.value ?? null;
    const d = h.blood_pressure?.diastolic?.value ?? null;
    const prev = yearMap.get(y) || { sVals: [], dVals: [] };
    if (s != null) prev.sVals.push(s);
    if (d != null) prev.dVals.push(d);
    yearMap.set(y, prev);
  });

  // Average per year to a single point
  const years = [...yearMap.keys()].sort((a,b)=>a-b);
  const systolic = years.map((y)=> {
    const arr = yearMap.get(y).sVals;
    return Math.round(arr.reduce((a,c)=>a+c,0)/Math.max(arr.length,1));
  });
  const diastolic = years.map((y)=> {
    const arr = yearMap.get(y).dVals;
    return Math.round(arr.reduce((a,c)=>a+c,0)/Math.max(arr.length,1));
  });

  if (bpChart) bpChart.destroy();
  bpChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: years,
      datasets: [
        { label: "Systolic", data: systolic, tension: 0.35, borderWidth: 2, pointRadius: 3 },
        { label: "Diastolic", data: diastolic, tension: 0.35, borderWidth: 2, pointRadius: 3 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.06)" } },
        y: { grid: { color: "rgba(255,255,255,0.06)" }, suggestedMin: 60, suggestedMax: 180 }
      },
      plugins: {
        legend: { labels: { color: "#eef2f7" } },
        tooltip: { mode: "index", intersect: false }
      }
    }
  });
}

function populatePatientList(patients, activeName) {
  const list = document.getElementById("patientList");
  list.innerHTML = "";
  patients.forEach((p) => {
    const li = el("li", "patient-item" + (p.name === activeName ? " active" : ""));
    li.setAttribute("role", "listitem");
    li.innerHTML = `
      <img src="${p.profile_picture}" alt="Avatar of ${p.name}" class="patient-avatar" />
      <div class="patient-meta">
        <div class="patient-name">${p.name}</div>
        <div class="patient-sub">${p.gender ?? ""} • ${p.age ?? ""}</div>
      </div>
    `;
    list.appendChild(li);
  });
}

function fillProfile(p) {
  $("#patientAvatar").src = p.profile_picture;
  $("#profileAvatar").src = p.profile_picture;
  $("#patientName").textContent = p.name;
  $("#profileName").textContent = p.name;

  const dob = formatDOB(p.date_of_birth);
  $("#patientDOB").textContent = dob;
  $("#pDOB").textContent = dob;

  $("#patientPhone").textContent = p.phone_number || "—";
  $("#pPhone").textContent = p.phone_number || "—";

  $("#patientEmergency").textContent = p.emergency_contact || "—";
  $("#pEmergency").textContent = p.emergency_contact || "—";

  $("#patientInsurance").textContent = p.insurance_type || "—";
  $("#pInsurance").textContent = p.insurance_type || "—";

  $("#pGender").textContent = p.gender || "—";
  $("#profileBio").textContent = `${p.gender || "—"} • ${dob}`;
}

async function init() {
  try {
    const patients = await fetchPatients();
    const jess = findJessica(patients);

    // Safety: if API shape changes, guard rendering
    if (!jess) throw new Error("Jessica Taylor not found in the API response.");

    populatePatientList(patients, "Jessica Taylor");
    fillProfile(jess);

    // Chart + latest vitals from most recent entry
    const history = Array.isArray(jess.diagnosis_history) ? jess.diagnosis_history : [];
    renderBPChart(history);
    const latest = history.slice().sort((a,b)=> (b.year ?? 0) - (a.year ?? 0))[0];
    setVitals(latest);

    renderDxHistory(history);
    renderDxList(jess.diagnostic_list || []);
    renderLabResults(jess.lab_results || []);

    // Accessibility: move focus to main after load
    document.getElementById("main").focus();
  } catch (err) {
    console.error(err);
    alert("Failed to load patient data. Please re-check API credentials or try again.");
  }
}

window.addEventListener("DOMContentLoaded", init);
