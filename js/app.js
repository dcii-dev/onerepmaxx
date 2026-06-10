(function () {
  "use strict";

  const THEME_KEY = "onerepmaxx-theme";
  const PR_HISTORY_KEY = "onerepmaxx-pr-history";

  const REP_PERCENTAGES = [
    { reps: 1, pct: 1.0, zone: "strength" },
    { reps: 2, pct: 0.97, zone: "strength" },
    { reps: 3, pct: 0.94, zone: "strength" },
    { reps: 4, pct: 0.91, zone: "strength" },
    { reps: 5, pct: 0.88, zone: "strength" },
    { reps: 6, pct: 0.85, zone: "hypertrophy" },
    { reps: 7, pct: 0.83, zone: "hypertrophy" },
    { reps: 8, pct: 0.8, zone: "hypertrophy" },
    { reps: 10, pct: 0.75, zone: "hypertrophy" },
    { reps: 12, pct: 0.7, zone: "hypertrophy" },
    { reps: 15, pct: 0.65, zone: "endurance" },
  ];

  const ZONE_LABELS = {
    strength: "Maximal Strength",
    hypertrophy: "Hypertrophy",
    endurance: "Muscular Endurance",
  };

  const PROGRAM_PRESETS = [
    { program: "5/3/1", phase: "Week 1", sets: "3 x 5", pct: 0.75 },
    { program: "5/3/1", phase: "Week 1 (top)", sets: "1 x 5+", pct: 0.85 },
    { program: "5/3/1", phase: "Week 2", sets: "3 x 3", pct: 0.8 },
    { program: "5/3/1", phase: "Week 2 (top)", sets: "1 x 3+", pct: 0.9 },
    { program: "5/3/1", phase: "Week 3", sets: "5/3/1", pct: 0.85 },
    { program: "5/3/1", phase: "Week 3 (top)", sets: "1 x 1+", pct: 0.95 },
    { program: "Texas Method", phase: "Volume Day", sets: "5 x 5", pct: 0.9 },
    {
      program: "Texas Method",
      phase: "Intensity Day",
      sets: "1 x 5",
      pct: 1.0,
    },
    { program: "Starting Strength", phase: "Working", sets: "3 x 5", pct: 0.9 },
    { program: "GZCLP T1", phase: "Working", sets: "5 x 3", pct: 0.85 },
    { program: "GZCLP T2", phase: "Working", sets: "4 x 10", pct: 0.65 },
    { program: "NSuns 5/3/1", phase: "Main sets", sets: "3/3/3+", pct: 0.88 },
    { program: "NSuns 5/3/1", phase: "Supplemental", sets: "4 x 6", pct: 0.7 },
  ];

  /**
   * Bodyweight multiplier strength standards (approximate, compound barbell lifts).
   * @type {Array<{min: number, label: string, cls: string}>}
   */
  const BW_RATINGS = [
    { min: 2.5, label: "Elite", cls: "bw-panel__scale-label--elite" },
    { min: 2.0, label: "Advanced", cls: "bw-panel__scale-label--advanced" },
    {
      min: 1.5,
      label: "Intermediate",
      cls: "bw-panel__scale-label--intermediate",
    },
    { min: 1.0, label: "Novice", cls: "bw-panel__scale-label--novice" },
    { min: 0, label: "Beginner", cls: "bw-panel__scale-label--beginner" },
  ];

  let activeLift = "Squat";
  let calcMode = "forward"; // "forward" | "reverse"

  const WARMUP_SETS = [
    { label: "Bar", pct: null, reps: 10 },
    { label: "1", pct: 0.4, reps: 8 },
    { label: "2", pct: 0.55, reps: 5 },
    { label: "3", pct: 0.7, reps: 3 },
    { label: "4", pct: 0.8, reps: 2 },
    { label: "5", pct: 0.9, reps: 1 },
  ];

  const COMP_ATTEMPTS = [
    { label: "Opener", pct: 0.9, ordinal: "1st" },
    { label: "2nd Attempt", pct: 0.97, ordinal: "2nd" },
    { label: "3rd Attempt", pct: 1.03, ordinal: "3rd" },
  ];

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    const isDark = theme === "dark";
    btn.setAttribute("aria-pressed", String(isDark));
    btn.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode",
    );
  }

  function initializeTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") {
      applyTheme(stored);
      return;
    }
    applyTheme(
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light",
    );
  }

  function toggleTheme() {
    const current =
      document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  /**
   * Announces a message to screen readers via the status live region.
   * @param {string} msg
   */
  function announce(msg) {
    const el = document.getElementById("action-status");
    if (!el) return;
    el.textContent = "";
    // Reset then set so repeated identical messages still fire
    requestAnimationFrame(function () {
      el.textContent = msg;
    });
  }

  function activateLiftTab(tab) {
    document.querySelectorAll(".lift-tab").forEach(function (t) {
      t.classList.remove("lift-tab--active");
      t.setAttribute("aria-pressed", "false");
    });
    tab.classList.add("lift-tab--active");
    tab.setAttribute("aria-pressed", "true");
    activeLift = tab.dataset.lift;
    calculate();
  }

  function activateResultsTab(tab) {
    document.querySelectorAll(".results-tab").forEach(function (t) {
      t.classList.remove("results-tab--active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("results-tab--active");
    tab.setAttribute("aria-selected", "true");
    const target = tab.dataset.target;
    const panels = [
      "training-table",
      "program-presets",
      "warmup-table",
      "comp-attempts",
    ];
    for (const id of panels) {
      const el = document.getElementById(id);
      if (el) el.hidden = id !== target;
    }
  }

  /**
   * Handles arrow-key navigation within the results tablist.
   * @param {KeyboardEvent} e
   */
  function handleResultsTabKeydown(e) {
    const tabs = Array.from(document.querySelectorAll(".results-tab"));
    const idx = tabs.indexOf(e.currentTarget);
    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next !== -1) {
      e.preventDefault();
      activateResultsTab(tabs[next]);
      tabs[next].focus();
    }
  }

  /**
   * Switches between forward (estimate 1RM) and reverse (find working weight) modes.
   * @param {string} mode - "forward" or "reverse"
   */
  function setCalcMode(mode) {
    calcMode = mode;
    const fwdBtn = document.getElementById("mode-forward");
    const revBtn = document.getElementById("mode-reverse");
    const weightLabel = document.getElementById("weight-label");
    const weightHint = document.getElementById("weight-hint");
    const weightInput = document.getElementById("weight");
    if (fwdBtn) {
      fwdBtn.classList.toggle(
        "calc-mode-toggle__btn--active",
        mode === "forward",
      );
      fwdBtn.setAttribute("aria-pressed", String(mode === "forward"));
    }
    if (revBtn) {
      revBtn.classList.toggle(
        "calc-mode-toggle__btn--active",
        mode === "reverse",
      );
      revBtn.setAttribute("aria-pressed", String(mode === "reverse"));
    }
    if (mode === "reverse") {
      if (weightLabel) weightLabel.textContent = "Target 1RM";
      if (weightHint)
        weightHint.textContent =
          "Enter your known or estimated 1RM to find back-calculated working weights.";
      if (weightInput) weightInput.placeholder = "e.g. 315";
    } else {
      if (weightLabel) weightLabel.textContent = "Weight Lifted";
      if (weightHint)
        weightHint.textContent = "The weight on the bar for your working set.";
      if (weightInput) weightInput.placeholder = "e.g. 225";
    }
    calculate();
  }

  function brzycki(weight, reps) {
    if (reps === 1) return weight;
    const denom = 1.0278 - 0.0278 * reps;
    if (denom <= 0) return weight * 1.5;
    return weight / denom;
  }

  function epley(weight, reps) {
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
  }

  function lombardi(weight, reps) {
    if (reps === 1) return weight;
    return weight * Math.pow(reps, 0.1);
  }

  function getSelectedUnit() {
    const checked = document.querySelector('[name="unit"]:checked');
    return checked ? checked.value : "lbs";
  }

  function getBWRating(multiplier) {
    return (
      BW_RATINGS.find(function (r) {
        return multiplier >= r.min;
      }) || BW_RATINGS[BW_RATINGS.length - 1]
    );
  }

  function renderBWMultiplier(oneRM) {
    const bwInput = document.getElementById("bodyweight");
    const bwPanel = document.getElementById("bw-panel");
    const resultEl = document.getElementById("result-bw-multiplier");
    const ratingEl = document.getElementById("bw-rating");
    if (!bwPanel || !resultEl) return;
    const bw = parseFloat(bwInput ? bwInput.value : "");
    if (!bw || bw <= 0) {
      bwPanel.hidden = true;
      return;
    }
    const multiplier = oneRM / bw;
    resultEl.textContent = multiplier.toFixed(2);
    const rating = getBWRating(multiplier);
    if (ratingEl) {
      ratingEl.textContent = rating.label;
      ratingEl.className = "bw-panel__scale-label " + rating.cls;
    }
    bwPanel.hidden = false;
  }

  function updateUnitLabels(unit) {
    const ids = [
      "weight-suffix",
      "brzycki-unit",
      "epley-unit",
      "lombardi-unit",
      "consensus-unit",
      "bodyweight-suffix",
    ];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.textContent = unit;
    }
  }

  function formatWeight(value) {
    return Math.round(value).toLocaleString();
  }

  function zoneBadgeClass(zone) {
    const map = {
      strength: "training-table__badge--strength",
      hypertrophy: "training-table__badge--hypertrophy",
      endurance: "training-table__badge--endurance",
    };
    return map[zone] || "";
  }

  function renderTrainingTable(oneRM, unit) {
    const tbody = document.getElementById("training-table-body");
    if (!tbody) return;
    const fragment = document.createDocumentFragment();
    for (const entry of REP_PERCENTAGES) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="training-table__cell--highlight">' +
        entry.reps +
        "</td><td>" +
        Math.round(entry.pct * 100) +
        "%</td><td>" +
        formatWeight(oneRM * entry.pct) +
        " " +
        unit +
        '</td><td><span class="training-table__badge ' +
        zoneBadgeClass(entry.zone) +
        '">' +
        ZONE_LABELS[entry.zone] +
        "</span></td>";
      fragment.appendChild(tr);
    }
    tbody.replaceChildren(fragment);
  }

  function renderProgramPresets(oneRM, unit) {
    const tbody = document.getElementById("program-presets-body");
    if (!tbody) return;
    const fragment = document.createDocumentFragment();
    let lastProgram = "";
    for (const entry of PROGRAM_PRESETS) {
      const tr = document.createElement("tr");
      const programCell =
        entry.program !== lastProgram
          ? '<td class="training-table__cell--highlight">' +
            entry.program +
            "</td>"
          : '<td class="program-presets__program-repeat"></td>';
      lastProgram = entry.program;
      tr.innerHTML =
        programCell +
        "<td>" +
        entry.phase +
        "</td><td>" +
        entry.sets +
        "</td><td>" +
        Math.round(entry.pct * 100) +
        "%</td><td>" +
        formatWeight(oneRM * entry.pct) +
        " " +
        unit +
        "</td>";
      fragment.appendChild(tr);
    }
    tbody.replaceChildren(fragment);
  }

  /**
   * Renders the warm-up ramp table based on the estimated 1RM.
   * @param {number} oneRM
   * @param {string} unit
   */
  function renderWarmupRamp(oneRM, unit) {
    const tbody = document.getElementById("warmup-table-body");
    if (!tbody) return;
    const barWeight = unit === "kg" ? 20 : 45;
    const fragment = document.createDocumentFragment();
    for (const set of WARMUP_SETS) {
      const weight =
        set.pct === null ? barWeight : Math.round((oneRM * set.pct) / 5) * 5;
      const pctLabel =
        set.pct === null
          ? "~" + Math.round((barWeight / oneRM) * 100) + "%"
          : Math.round(set.pct * 100) + "%";
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="training-table__cell--highlight">' +
        set.label +
        "</td>" +
        "<td>" +
        pctLabel +
        "</td>" +
        "<td>" +
        weight +
        " " +
        unit +
        "</td>" +
        "<td>" +
        set.reps +
        "</td>";
      fragment.appendChild(tr);
    }
    tbody.replaceChildren(fragment);
  }

  /**
   * Renders the competition attempt cards based on the estimated 1RM.
   * @param {number} oneRM
   * @param {string} unit
   */
  function renderCompAttempts(oneRM, unit) {
    const container = document.getElementById("comp-attempts-cards");
    if (!container) return;
    const fragment = document.createDocumentFragment();
    for (const attempt of COMP_ATTEMPTS) {
      const weight = Math.round((oneRM * attempt.pct) / 2.5) * 2.5;
      const card = document.createElement("div");
      card.className = "comp-card";
      card.innerHTML =
        '<span class="comp-card__ordinal">' +
        attempt.ordinal +
        "</span>" +
        '<span class="comp-card__label">' +
        attempt.label +
        "</span>" +
        '<span class="comp-card__pct">' +
        Math.round(attempt.pct * 100) +
        "% of 1RM</span>" +
        '<span class="comp-card__weight">' +
        weight +
        ' <span class="comp-card__unit">' +
        unit +
        "</span></span>";
      fragment.appendChild(card);
    }
    container.replaceChildren(fragment);
  }

  /**
   * Applies URL search params to pre-fill the calculator inputs.
   */
  function applyUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const w = params.get("w");
    const r = params.get("r");
    const u = params.get("u");
    const m = params.get("m");
    if (u === "kg") {
      const kgRadio = document.getElementById("unit-kg");
      if (kgRadio) kgRadio.checked = true;
    }
    if (w) {
      const wInput = document.getElementById("weight");
      if (wInput) wInput.value = w;
    }
    if (r) {
      const rInput = document.getElementById("reps");
      if (rInput) rInput.value = r;
    }
    if (m === "reverse") {
      setCalcMode("reverse");
    } else if (w || r) {
      calculate();
    }
  }

  /**
   * Encodes the current inputs into the URL and copies the share link to clipboard.
   */
  function shareResult() {
    const w = document.getElementById("weight");
    const r = document.getElementById("reps");
    const btn = document.getElementById("share-btn");
    if (!w || !r || !btn) return;
    const unit = getSelectedUnit();
    const params = new URLSearchParams();
    if (w.value) params.set("w", w.value);
    if (r.value) params.set("r", r.value);
    if (unit !== "lbs") params.set("u", unit);
    if (calcMode === "reverse") params.set("m", "reverse");
    const url =
      window.location.origin +
      window.location.pathname +
      (params.toString() ? "?" + params.toString() : "");
    history.replaceState(null, "", url);
    navigator.clipboard
      .writeText(url)
      .then(function () {
        const original = btn.textContent;
        btn.textContent = "Copied!";
        btn.disabled = true;
        announce("Share link copied to clipboard.");
        setTimeout(function () {
          btn.textContent = original;
          btn.disabled = false;
        }, 1800);
      })
      .catch(function () {
        btn.textContent = "Failed";
        announce("Share failed. Please try again.");
        setTimeout(function () {
          btn.textContent = "Share";
        }, 1800);
      });
  }

  /**
   * Exports the PR history as a downloadable CSV file.
   */
  function exportCSV() {
    const history = loadHistory();
    if (!history.length) return;
    const rows = [["Lift", "Weight", "Unit", "Reps", "Estimated 1RM", "Date"]];
    for (const e of history) {
      rows.push([
        e.lift,
        e.weight,
        e.unit,
        e.reps,
        Math.round(e.consensus),
        new Date(e.date).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
      ]);
    }
    const csv = rows
      .map(function (row) {
        return row
          .map(function (cell) {
            const s = String(cell);
            return s.includes(",") || s.includes('"')
              ? '"' + s.replace(/"/g, '""') + '"'
              : s;
          })
          .join(",");
      })
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "onerepmaxx-pr-history.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Draws a sparkline on a canvas element showing 1RM trend over time.
   * @param {HTMLCanvasElement} canvas
   * @param {number[]} values - Array of 1RM values in chronological order.
   */
  function drawSparkline(canvas, values) {
    if (values.length < 2) {
      canvas.hidden = true;
      return;
    }
    canvas.hidden = false;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth || 200;
    const h = canvas.offsetHeight || 48;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const pad = 6;
    const minVal = Math.min.apply(null, values);
    const maxVal = Math.max.apply(null, values);
    const range = maxVal - minVal || 1;
    const style = getComputedStyle(document.documentElement);
    const accentColor =
      style.getPropertyValue("--clr-accent").trim() || "#dc2626";
    const textMuted =
      style.getPropertyValue("--clr-text-muted").trim() || "#888";

    /**
     * Maps a value to an x/y coordinate on the canvas.
     * @param {number} i - Index.
     * @param {number} v - Value.
     * @return {{x: number, y: number}}
     */
    function toPoint(i, v) {
      return {
        x: pad + (i / (values.length - 1)) * (w - pad * 2),
        y: pad + (1 - (v - minVal) / range) * (h - pad * 2),
      };
    }

    ctx.clearRect(0, 0, w, h);

    // Fill area
    ctx.beginPath();
    const first = toPoint(0, values[0]);
    ctx.moveTo(first.x, h - pad);
    ctx.lineTo(first.x, first.y);
    for (let i = 1; i < values.length; i++) {
      const p = toPoint(i, values[i]);
      ctx.lineTo(p.x, p.y);
    }
    const last = toPoint(values.length - 1, values[values.length - 1]);
    ctx.lineTo(last.x, h - pad);
    ctx.closePath();
    ctx.fillStyle = accentColor
      .replace(")", ", 0.12)")
      .replace("rgb", "rgba")
      .replace("#dc2626", "rgba(220,38,38,0.12)");
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < values.length; i++) {
      const p = toPoint(i, values[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = accentColor.includes("#") ? accentColor : "#dc2626";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    // Dots at each data point
    const dotColor = accentColor.includes("#") ? accentColor : "#dc2626";
    const bgColor = style.getPropertyValue("--clr-bg").trim() || "#0f1117";
    for (let i = 0; i < values.length; i++) {
      const p = toPoint(i, values[i]);
      const isLast = i === values.length - 1;
      const radius = isLast ? 4 : 3;
      // Ring outline using background color for contrast
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 1.5, 0, Math.PI * 2);
      ctx.fillStyle = bgColor;
      ctx.globalAlpha = isLast ? 1 : 0.85;
      ctx.fill();
      // Dot fill
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.globalAlpha = 1;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function calculate() {
    const weightInput = document.getElementById("weight");
    const repsInput = document.getElementById("reps");
    const weight = parseFloat(weightInput ? weightInput.value : "");
    const reps = parseInt(repsInput ? repsInput.value : "", 10);

    const formulaGrid = document.getElementById("formula-grid");
    const consensusPanel = document.getElementById("consensus-panel");
    const resultsTabs = document.getElementById("results-tabs");
    const trainingTable = document.getElementById("training-table");
    const programPresets = document.getElementById("program-presets");
    const warmupTable = document.getElementById("warmup-table");
    const compAttempts = document.getElementById("comp-attempts");
    const bwPanel = document.getElementById("bw-panel");
    const emptyState = document.getElementById("results-empty");
    const consensusLabel = document.querySelector(".consensus__label");
    const consensusSubtitle = document.querySelector(".consensus__subtitle");

    const isValid =
      !Number.isNaN(weight) &&
      !Number.isNaN(reps) &&
      weight > 0 &&
      reps >= 1 &&
      reps <= 20;

    // Form validation aria feedback
    if (weightInput)
      weightInput.setAttribute(
        "aria-invalid",
        !Number.isNaN(weight) && weight > 0 ? "false" : "true",
      );
    if (repsInput)
      repsInput.setAttribute(
        "aria-invalid",
        !Number.isNaN(reps) && reps >= 1 && reps <= 20 ? "false" : "true",
      );

    if (!isValid) {
      if (formulaGrid) formulaGrid.hidden = true;
      if (consensusPanel) consensusPanel.hidden = true;
      if (resultsTabs) resultsTabs.hidden = true;
      if (trainingTable) trainingTable.hidden = true;
      if (programPresets) programPresets.hidden = true;
      if (warmupTable) warmupTable.hidden = true;
      if (compAttempts) compAttempts.hidden = true;
      if (bwPanel) bwPanel.hidden = true;
      if (emptyState) emptyState.hidden = false;
      return;
    }

    const unit = getSelectedUnit();
    let brzyckiResult, epleyResult, lombardiResult, consensus;

    if (calcMode === "reverse") {
      // weight input is treated as target 1RM; back-calculate working weight per formula
      const targetOneRM = weight;
      brzyckiResult = targetOneRM * (1.0278 - 0.0278 * reps);
      epleyResult = reps === 1 ? targetOneRM : targetOneRM / (1 + reps / 30);
      lombardiResult =
        reps === 1 ? targetOneRM : targetOneRM / Math.pow(reps, 0.1);
      consensus = (brzyckiResult + epleyResult + lombardiResult) / 3;
      if (consensusLabel)
        consensusLabel.textContent =
          "Working Weight (" + reps + " rep" + (reps === 1 ? "" : "s") + ")";
      if (consensusSubtitle)
        consensusSubtitle.textContent =
          "Average back-calculated weight for " + reps + " reps";
    } else {
      brzyckiResult = brzycki(weight, reps);
      epleyResult = epley(weight, reps);
      lombardiResult = lombardi(weight, reps);
      consensus = (brzyckiResult + epleyResult + lombardiResult) / 3;
      if (consensusLabel) consensusLabel.textContent = "Estimated 1RM";
      if (consensusSubtitle)
        consensusSubtitle.textContent =
          "Average of Brzycki, Epley \u0026 Lombardi";
    }

    const resultBrzycki = document.getElementById("result-brzycki");
    const resultEpley = document.getElementById("result-epley");
    const resultLombardi = document.getElementById("result-lombardi");
    const resultConsensus = document.getElementById("result-consensus");
    if (resultBrzycki) resultBrzycki.textContent = formatWeight(brzyckiResult);
    if (resultEpley) resultEpley.textContent = formatWeight(epleyResult);
    if (resultLombardi)
      resultLombardi.textContent = formatWeight(lombardiResult);
    if (resultConsensus) resultConsensus.textContent = formatWeight(consensus);

    // In reverse mode, use the input (target 1RM) as the base for tables
    const oneRMForTables = calcMode === "reverse" ? weight : consensus;

    updateUnitLabels(unit);
    renderTrainingTable(oneRMForTables, unit);
    renderProgramPresets(oneRMForTables, unit);
    renderWarmupRamp(oneRMForTables, unit);
    renderCompAttempts(oneRMForTables, unit);
    renderBWMultiplier(oneRMForTables);

    if (emptyState) emptyState.hidden = true;
    if (formulaGrid) formulaGrid.hidden = false;
    if (consensusPanel) consensusPanel.hidden = false;
    if (resultsTabs) resultsTabs.hidden = false;

    const activeResultsTab = document.querySelector(".results-tab--active");
    const target = activeResultsTab
      ? activeResultsTab.dataset.target
      : "training-table";
    const allPanels = {
      "training-table": trainingTable,
      "program-presets": programPresets,
      "warmup-table": warmupTable,
      "comp-attempts": compAttempts,
    };
    for (const key of Object.keys(allPanels)) {
      if (allPanels[key]) allPanels[key].hidden = key !== target;
    }
  }

  /**
   * Builds a plain-text summary of all saved PR history entries.
   * @return {string} Formatted PR history, or empty string if none.
   */
  function buildHistoryText() {
    const history = loadHistory();
    if (!history.length) return "";
    const byLift = {};
    for (const entry of history) {
      if (!byLift[entry.lift]) byLift[entry.lift] = [];
      byLift[entry.lift].push(entry);
    }
    const lines = ["1RM PR History"];
    for (const lift of Object.keys(byLift)) {
      lines.push("\n" + lift);
      for (const e of byLift[lift]) {
        lines.push(
          "  " +
            e.weight +
            " " +
            e.unit +
            " x" +
            e.reps +
            "  \u2192  ~" +
            Math.round(e.consensus) +
            " " +
            e.unit +
            " 1RM  (" +
            new Date(e.date).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            }) +
            ")",
        );
      }
    }
    return lines.join("\n");
  }

  function copyResult() {
    const btn = document.getElementById("copy-btn");
    if (!btn) return;
    const historyText = buildHistoryText();
    const consensus = document.getElementById("result-consensus");
    const unit = document.getElementById("consensus-unit");
    const fallback = (
      (consensus ? consensus.textContent : "") +
      " " +
      (unit ? unit.textContent : "")
    ).trim();
    const text = historyText || fallback;
    navigator.clipboard
      .writeText(text)
      .then(function () {
        const original = btn.textContent;
        btn.textContent = "Copied!";
        btn.disabled = true;
        announce("Result copied to clipboard.");
        setTimeout(function () {
          btn.textContent = original;
          btn.disabled = false;
        }, 1800);
      })
      .catch(function () {
        btn.textContent = "Failed";
        announce("Copy failed. Please try again.");
        setTimeout(function () {
          btn.textContent = "Copy";
        }, 1800);
      });
  }

  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(PR_HISTORY_KEY) || "[]");
    } catch (_) {
      return [];
    }
  }

  function saveHistory(history) {
    localStorage.setItem(PR_HISTORY_KEY, JSON.stringify(history));
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function renderHistory() {
    const list = document.getElementById("pr-history-list");
    const empty = document.getElementById("pr-history-empty");
    const clearBtn = document.getElementById("clear-history-btn");
    const copyAllBtn = document.getElementById("copy-history-btn");
    const exportBtn = document.getElementById("export-history-btn");
    if (!list || !empty) return;

    const history = loadHistory();
    if (history.length === 0) {
      list.hidden = true;
      empty.hidden = false;
      if (clearBtn) clearBtn.hidden = true;
      if (copyAllBtn) copyAllBtn.hidden = true;
      if (exportBtn) exportBtn.hidden = true;
      return;
    }

    list.hidden = false;
    empty.hidden = true;
    if (clearBtn) clearBtn.hidden = false;
    if (copyAllBtn) copyAllBtn.hidden = false;
    if (exportBtn) exportBtn.hidden = false;

    const grouped = {};
    for (const entry of history) {
      const key = entry.lift || "Custom";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(entry);
    }

    const fragment = document.createDocumentFragment();
    for (const liftName of Object.keys(grouped)) {
      const entries = grouped[liftName];
      const group = document.createElement("div");
      group.className = "pr-group";
      const heading = document.createElement("h3");
      heading.className = "pr-group__title";
      heading.textContent = liftName;
      group.appendChild(heading);

      // Sparkline
      const sparklineValues = entries.map(function (e) {
        return e.consensus;
      });
      const canvas = document.createElement("canvas");
      canvas.className = "pr-sparkline";
      canvas.setAttribute("aria-hidden", "true");
      group.appendChild(canvas);
      // Draw after append so offsetWidth is available
      requestAnimationFrame(
        (function (c, vals) {
          return function () {
            drawSparkline(c, vals);
          };
        })(canvas, sparklineValues),
      );

      const rows = document.createElement("div");
      rows.className = "pr-group__rows";
      const reversed = entries.slice().reverse();
      for (const entry of reversed) {
        const row = document.createElement("div");
        row.className = "pr-row";
        row.setAttribute("role", "listitem");
        row.setAttribute("data-id", entry.id);
        const deleteLabel =
          "Delete " +
          entry.lift +
          " " +
          entry.weight +
          entry.unit +
          " \u00d7 " +
          entry.reps +
          " rep" +
          (entry.reps !== 1 ? "s" : "") +
          " PR";
        row.innerHTML =
          '<div class="pr-row__meta"><span class="pr-row__date">' +
          formatDate(entry.date) +
          '</span></div><div class="pr-row__values"><span class="pr-row__set">' +
          entry.weight +
          " " +
          entry.unit +
          " \u00d7 " +
          entry.reps +
          '</span><span class="pr-row__arrow">\u2192</span><span class="pr-row__result">' +
          Math.round(entry.consensus) +
          " " +
          entry.unit +
          ' 1RM</span></div><button class="pr-row__delete-btn" type="button" aria-label="' +
          deleteLabel +
          '" data-id="' +
          entry.id +
          '">\u00d7</button>';
        rows.appendChild(row);
      }
      group.appendChild(rows);
      fragment.appendChild(group);
    }

    list.replaceChildren(fragment);
    list.querySelectorAll(".pr-row__delete-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        deletePrEntry(e.currentTarget.dataset.id);
      });
    });
  }

  function savePR() {
    const weightInput = document.getElementById("weight");
    const repsInput = document.getElementById("reps");
    const consensusEl = document.getElementById("result-consensus");
    const weight = parseFloat(weightInput ? weightInput.value : "");
    const reps = parseInt(repsInput ? repsInput.value : "", 10);
    const consensus = parseFloat(
      consensusEl ? consensusEl.textContent.replace(/,/g, "") : "",
    );
    if (!weight || !reps || !consensus) return;
    const unit = getSelectedUnit();
    const history = loadHistory();
    history.push({
      id: String(Date.now()),
      lift: activeLift,
      weight: weight,
      reps: reps,
      unit: unit,
      consensus: consensus,
      date: new Date().toISOString(),
    });
    saveHistory(history);
    renderHistory();
    const btn = document.getElementById("save-btn");
    if (btn) {
      const original = btn.textContent;
      btn.textContent = "Saved!";
      btn.disabled = true;
      announce(activeLift + " PR saved.");
      setTimeout(function () {
        btn.textContent = original;
        btn.disabled = false;
      }, 1500);
    }
  }

  function deletePrEntry(id) {
    saveHistory(
      loadHistory().filter(function (e) {
        return e.id !== id;
      }),
    );
    renderHistory();
  }

  function clearAllHistory() {
    if (!window.confirm("Clear all saved PRs? This cannot be undone.")) return;
    localStorage.removeItem(PR_HISTORY_KEY);
    renderHistory();
  }

  function setFooterYear() {
    const el = document.getElementById("footer-year");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  function initializeApp() {
    initializeTheme();
    setFooterYear();
    renderHistory();

    const themeBtn = document.getElementById("theme-toggle");
    if (themeBtn) {
      themeBtn.addEventListener("click", toggleTheme);
    }

    const form = document.getElementById("1rm-form");
    if (form) {
      form.addEventListener("input", calculate);
    }

    document.querySelectorAll(".lift-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        activateLiftTab(tab);
      });
    });

    document.querySelectorAll(".results-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        activateResultsTab(tab);
      });
      tab.addEventListener("keydown", handleResultsTabKeydown);
    });

    const copyBtn = document.getElementById("copy-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", copyResult);
    }

    const saveBtn = document.getElementById("save-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", savePR);
    }

    const clearBtn = document.getElementById("clear-history-btn");
    if (clearBtn) {
      clearBtn.addEventListener("click", clearAllHistory);
    }

    const copyHistoryBtn = document.getElementById("copy-history-btn");
    if (copyHistoryBtn) {
      copyHistoryBtn.addEventListener("click", function () {
        const text = buildHistoryText();
        if (!text) return;
        navigator.clipboard
          .writeText(text)
          .then(function () {
            const original = copyHistoryBtn.textContent;
            copyHistoryBtn.textContent = "Copied!";
            copyHistoryBtn.disabled = true;
            announce("PR history copied to clipboard.");
            setTimeout(function () {
              copyHistoryBtn.textContent = original;
              copyHistoryBtn.disabled = false;
            }, 1800);
          })
          .catch(function () {
            copyHistoryBtn.textContent = "Failed";
            announce("Copy failed. Please try again.");
            setTimeout(function () {
              copyHistoryBtn.textContent = "Copy All";
            }, 1800);
          });
      });
    }

    const exportBtn = document.getElementById("export-history-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", exportCSV);
    }

    const shareBtn = document.getElementById("share-btn");
    if (shareBtn) {
      shareBtn.addEventListener("click", shareResult);
    }

    const fwdBtn = document.getElementById("mode-forward");
    if (fwdBtn) {
      fwdBtn.addEventListener("click", function () {
        setCalcMode("forward");
      });
    }

    const revBtn = document.getElementById("mode-reverse");
    if (revBtn) {
      revBtn.addEventListener("click", function () {
        setCalcMode("reverse");
      });
    }

    applyUrlParams();
  }

  if (document.readyState === "complete") {
    initializeApp();
  } else {
    window.addEventListener("load", initializeApp, { once: true });
  }
})();
