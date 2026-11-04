/* ============================================================
   열역학 제1법칙 시뮬레이터
   이상기체(단원자 분자, γ=5/3)를 가정한다. ΔU=(3/2)(P2V2-P1V1)은 과정에 관계없이
   항상 성립하고(이상기체 내부에너지는 T만의 함수), 일(W)은 과정별 공식으로 계산해
   Q=ΔU+W로 확인한다.
   탭 1 「과정 하나씩」: 등적·등압·등온·단열 중 하나를 골라 슬라이더로 목표를 정한다.
   탭 2 「사이클 만들기」: 과정을 이어 붙이거나 스털링·카르노·가솔린·디젤 사이클을 본다.
   피스톤 안의 입자는 모형이다. 벽·피스톤과 실제로 충돌하지만 속력은 모델의 온도에 맞춘다.
   ============================================================ */

(() => {
  "use strict";

  const el = (id) => document.getElementById(id);
  const all = (sel) => Array.from(document.querySelectorAll(sel));

  // ---------- DOM ----------
  const pistonCanvas = el("pistonCanvas");
  const pvGraphCanvas = el("pvGraph");
  const energyCanvas = el("energyCanvas");
  const modeTag = el("modeTag");
  const dragInfo = el("dragInfo");
  const intro = el("intro");

  const tabButtons = all("#tabs .tab");
  const singleBar = el("singleBar");
  const cycleBar = el("cycleBar");

  const singleModeBtns = all("#singleModes .mode-btn");
  const singleSlider = el("singleSlider");
  const singleSliderLabel = el("singleSliderLabel");
  const singleSliderValue = el("singleSliderValue");
  const singleHomeBtn = el("singleHomeBtn");

  const settingsToggle = el("settingsToggle");
  const settingsOverlay = el("settingsOverlay");
  const settingsBackdrop = el("settingsBackdrop");
  const settingsClose = el("settingsClose");

  const p0Input = el("p0Input");
  const v0Input = el("v0Input");
  const nInput = el("nInput");
  const p0Value = el("p0Value");
  const v0Value = el("v0Value");
  const nValue = el("nValue");
  const t0Hint = el("t0Hint");

  const expInput = el("expInput");
  const coldInput = el("coldInput");
  const expValue = el("expValue");
  const coldValue = el("coldValue");
  const gasRInput = el("gasRInput");
  const gasKInput = el("gasKInput");
  const dslRInput = el("dslRInput");
  const dslCInput = el("dslCInput");
  const gasRValue = el("gasRValue");
  const gasKValue = el("gasKValue");
  const dslRValue = el("dslRValue");
  const dslCValue = el("dslCValue");
  const engineLabel = el("engineLabel");
  const engineGroups = all("[data-preset-for]");

  const presetButtons = all(".preset-btn");
  const builderRow = el("builderRow");
  const modeButtons = all("[data-mode]");
  const builderSliderWrap = el("builderSliderWrap");
  const builderSliderLabel = el("builderSliderLabel");
  const builderSlider = el("builderSlider");
  const builderSliderValue = el("builderSliderValue");
  const builderCloseHint = el("builderCloseHint");
  const confirmStepBtn = el("confirmStepBtn");

  const undoBtn = el("undoBtn");
  const resetBtn = el("resetBtn");
  const replayBtn = el("replayBtn");
  const loopBtn = el("loopBtn");

  const recDot = el("recDot");
  const valP = el("valP");
  const valV = el("valV");
  const valT = el("valT");
  const valN = el("valN");

  const procTitle = el("procTitle");
  const recDotProcess = el("recDotProcess");
  const procName = el("procName");
  const procDelta = el("procDelta");
  const procW = el("procW");
  const procQ = el("procQ");
  const procDU = el("procDU");
  const procCheck = el("procCheck");

  const recorderCycle = el("recorderCycle");
  const recDotCycle = el("recDotCycle");
  const valWnet = el("valWnet");
  const valQin = el("valQin");
  const valQout = el("valQout");
  const valEta = el("valEta");
  const cycleCheck = el("cycleCheck");

  // ---------- Constants ----------
  const R = 0.0821; // L*atm/(mol*K)
  const GAMMA = 5 / 3; // 단원자 이상기체

  const MODE_NAMES = { isobaric: "등압", isothermal: "등온", isochoric: "등적", adiabatic: "단열" };
  const MODE_COLORS = {
    isobaric: "#f59e0b",
    isothermal: "#10b981",
    isochoric: "#0ea5e9",
    adiabatic: "#ef4444",
  };
  const MODE_FILL = {
    isobaric: "rgba(245, 158, 11, 0.22)",
    isothermal: "rgba(16, 185, 129, 0.22)",
    isochoric: "rgba(14, 165, 233, 0.22)",
    adiabatic: "rgba(239, 68, 68, 0.2)",
  };
  const FILL_COMPRESS = "rgba(71, 85, 105, 0.22)";
  const COLOR_REF = "#a8aab2";
  const COLOR_NEUTRAL = "#391c57";
  const COLOR_CYCLE_FILL = "rgba(57, 28, 87, 0.10)";
  const COLOR_Q = "#6d28d9";
  const COLOR_W = "#0d9488";
  const COLOR_U = "#db2777";
  const SNAP_PX = 12;

  const NP = 40; // 입자 수 (n과 무관한 모형)
  const V_REF = 150; // 처음 온도에서의 입자 평균 제곱근 속력 (px/s)

  const LABELS = {
    stirling: ["B", "C", "D", "A"],
    carnot: ["A", "B", "C", "D"],
    gasoline: ["A", "B", "C", "D"],
    diesel: ["A", "B", "C", "D"],
    free: ["A", "B", "C", "D", "E", "F", "G", "H"],
  };

  const INTRO = {
    single: "과정을 고르고 슬라이더로 목표를 정하면, 입자·P–V 그래프·Q, W, ΔU가 함께 변한다.",
    cycle: "기관을 고르거나 과정을 이어 붙여 사이클을 만든다. 기준점으로 돌아오면 닫힌다.",
  };

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ---------- Physics ----------

  function tempOf(P, V, n) {
    return (P * V) / (n * R);
  }

  function computeSegment(mode, from, to, n) {
    const dU = 1.5 * (to.P * to.V - from.P * from.V);
    let W;
    if (mode === "isochoric") W = 0;
    else if (mode === "isobaric") W = from.P * (to.V - from.V);
    else if (mode === "isothermal") W = n * R * from.T * Math.log(to.V / from.V);
    else W = (from.P * from.V - to.P * to.V) / (GAMMA - 1);
    const Q = dU + W;
    return { dU, W, Q, dV: to.V - from.V, dP: to.P - from.P, dT: to.T - from.T };
  }

  function processLabel(mode, dV, dP) {
    const name = MODE_NAMES[mode];
    if (mode === "isochoric") return `${name} ${dP >= 0 ? "가열" : "냉각"}`;
    return `${name} ${dV >= 0 ? "팽창" : "압축"}`;
  }

  // 각 과정의 곡선 모양대로 from→to 사이를 샘플링한다 (그래프에 자취를 그리기 위함).
  function sampleSegmentCurve(mode, from, to, n, count = 40) {
    const pts = [];
    if (mode === "isobaric") {
      for (let i = 0; i <= count; i++) {
        const V = from.V + ((to.V - from.V) * i) / count;
        pts.push({ V, P: from.P });
      }
    } else if (mode === "isochoric") {
      for (let i = 0; i <= count; i++) {
        const P = from.P + ((to.P - from.P) * i) / count;
        pts.push({ V: from.V, P });
      }
    } else if (mode === "isothermal") {
      const nRT = n * R * from.T;
      for (let i = 0; i <= count; i++) {
        const V = from.V + ((to.V - from.V) * i) / count;
        pts.push({ V, P: nRT / V });
      }
    } else {
      const K = from.P * Math.pow(from.V, GAMMA);
      for (let i = 0; i <= count; i++) {
        const V = from.V + ((to.V - from.V) * i) / count;
        pts.push({ V, P: K / Math.pow(V, GAMMA) });
      }
    }
    return pts;
  }

  // 모드의 불변량을 고정한 채 자유 좌표(V 또는 P)만 바꿨을 때의 상태 (슬라이더용)
  function computeModeState(mode, base, freeVal, n) {
    if (mode === "isobaric") {
      const V = freeVal, P = base.P;
      return { P, V, T: tempOf(P, V, n) };
    }
    if (mode === "isochoric") {
      const P = freeVal, V = base.V;
      return { P, V, T: tempOf(P, V, n) };
    }
    if (mode === "isothermal") {
      const V = freeVal, P = (n * R * base.T) / V;
      return { P, V, T: tempOf(P, V, n) };
    }
    const V = freeVal;
    const K = base.P * Math.pow(base.V, GAMMA);
    const P = K / Math.pow(V, GAMMA);
    return { P, V, T: tempOf(P, V, n) };
  }

  // ---------- App state ----------

  const init = { P0: 1, V0: 10, n: 0.4 };
  const bounds = { Vmin: 1, Vmax: 30, Pmin: 0.1, Pmax: 4 };

  const app = { tab: "single" };

  // 탭 1: 처음 상태(P0, V0)에서 한 과정만 진행한다. cur는 목표(target)를 부드럽게 따라간다.
  const single = { mode: "isobaric", target: 10, cur: 10 };

  const sim = {
    current: { P: 1, V: 10, T: 0 },
    history: [], // { mode, from:{P,V,T}, to:{P,V,T}, W, Q, dU, dV, dP, dT }
    cycleClosed: false,
    cycleStats: null, // { Wnet, Qin, Qout, eta }
    preset: "free", // 'free' | 'stirling' | 'carnot' | 'gasoline' | 'diesel'
  };

  const builder = { mode: null, preview: null, willClose: false };

  const replay = { active: false, segIndex: 0, segStart: null, duration: 1100, loop: false, t: 0, history: [] };

  function getN() {
    return Number(nInput.value);
  }
  const num = (input) => Number(input.value);

  function startState() {
    return { P: init.P0, V: init.V0, T: tempOf(init.P0, init.V0, getN()) };
  }

  function recomputeBounds() {
    bounds.Vmax = Math.max(init.V0 * 3, 25);
    bounds.Vmin = Math.max(init.V0 * 0.12, 0.3);
    bounds.Pmax = Math.max(init.P0 * 3, 4);
    bounds.Pmin = Math.max(init.P0 * 0.12, 0.05);
  }

  function fitBoundsToPoints(pts) {
    const vs = pts.map((p) => p.V), ps = pts.map((p) => p.P);
    bounds.Vmax = Math.max(...vs) * 1.15;
    bounds.Vmin = Math.max(Math.min(...vs) * 0.7, 0.2);
    bounds.Pmax = Math.max(...ps) * 1.15;
    bounds.Pmin = Math.max(Math.min(...ps) * 0.5, 0.05);
  }

  function applyBounds() {
    if (app.tab === "single") {
      bounds.Vmax = init.V0 * 2.2;
      bounds.Vmin = init.V0 * 0.5;
      bounds.Pmax = init.P0 * 3.6;
      bounds.Pmin = init.P0 * 0.25;
    } else if (sim.preset !== "free" && sim.history.length) {
      fitBoundsToPoints(sim.history.flatMap((s) => [s.from, s.to]));
    } else {
      recomputeBounds();
    }
  }

  // 재생/반복재생 버튼 자체는 항상 눌러서 멈출 수 있어야 하므로, 잠글 때도 그 둘은 제외한다.
  // 기관 버튼도 잠그지 않는다 — 누르면 재생을 멈추고 그 기관으로 바뀐다.
  function setControlsLocked(locked) {
    modeButtons.forEach((b) => (b.disabled = locked));
    builderSlider.disabled = locked;
    resetBtn.disabled = locked;
    undoBtn.disabled = locked;
    if (locked) confirmStepBtn.disabled = true;
  }

  function syncEngineGroups() {
    let any = false;
    engineGroups.forEach((g) => {
      const show = app.tab === "cycle" && g.dataset.presetFor.split(" ").includes(sim.preset);
      g.classList.toggle("hidden", !show);
      if (show) any = true;
    });
    engineLabel.classList.toggle("hidden", !any);
  }

  function setPresetUI(kind) {
    presetButtons.forEach((b) => b.classList.toggle("active", b.dataset.preset === kind));
    builderRow.classList.toggle("hidden", kind !== "free");
    syncEngineGroups();
  }

  function cancelBuilder() {
    builder.mode = null;
    builder.preview = null;
    builder.willClose = false;
    modeButtons.forEach((b) => b.classList.remove("active"));
    builderSliderWrap.classList.add("hidden");
  }

  function cycleTagText() {
    if (sim.cycleClosed && sim.cycleStats) return `사이클 완성 · W_net = ${sim.cycleStats.Wnet.toFixed(2)} L·atm`;
    return sim.history.length ? "다음 과정을 선택하세요" : "과정을 선택하세요";
  }

  function resetState() {
    sim.current = startState();
    sim.history = [];
    sim.cycleClosed = false;
    sim.cycleStats = null;
    applyBounds();
    cancelBuilder();
    replay.active = false;
    replay.loop = false;
    if (app.tab === "cycle") modeTag.textContent = "과정을 선택하세요";
    dragInfo.classList.add("hidden");
    replayBtn.textContent = "재생";
    loopBtn.classList.remove("active");
    loopBtn.textContent = "반복재생";
    loopBtn.disabled = true;
    setControlsLocked(false);
    render();
  }

  // 현재 모드의 불변량(V, P, T, PV^γ 중 하나)이 이미 기준점의 값과 거의 같을 때만
  // 스냅을 허용한다 — 그래야 실제로 사이클을 "닫는" 마지막 과정에서만 동작한다.
  function canReachStart(mode, base, n) {
    const epsV = (bounds.Vmax - bounds.Vmin) * 0.02;
    const epsP = (bounds.Pmax - bounds.Pmin) * 0.02;
    if (mode === "isochoric") return Math.abs(base.V - init.V0) < epsV;
    if (mode === "isobaric") return Math.abs(base.P - init.P0) < epsP;
    if (mode === "isothermal") {
      const T0 = tempOf(init.P0, init.V0, n);
      return Math.abs(base.T - T0) < T0 * 0.02;
    }
    const K = base.P * Math.pow(base.V, GAMMA);
    const K0 = init.P0 * Math.pow(init.V0, GAMMA);
    return Math.abs(K - K0) / K0 < 0.02;
  }

  function closeCycle() {
    sim.cycleClosed = true;
    const Wnet = sim.history.reduce((s, seg) => s + seg.W, 0);
    const Qin = sim.history.reduce((s, seg) => s + (seg.Q > 0 ? seg.Q : 0), 0);
    const Qout = sim.history.reduce((s, seg) => s + (seg.Q < 0 ? -seg.Q : 0), 0);
    const eta = Qin > 0 ? Wnet / Qin : 0;
    sim.cycleStats = { Wnet, Qin, Qout, eta };
    modeTag.textContent = cycleTagText();
    loopBtn.disabled = false;
  }

  // ---------- 지금 화면에 보일 상태 ----------
  // state: 기체의 현재 상태 / mode: 장치 그림에 쓸 과정 / seg: 이 과정에서 지금까지의 Q·W·ΔU / segMode: seg의 과정

  function displayInfo() {
    const n = getN();
    if (app.tab === "single") {
      const from = startState();
      const state = computeModeState(single.mode, from, single.cur, n);
      const moved = Math.abs(state.V - from.V) > 1e-6 || Math.abs(state.P - from.P) > 1e-6;
      return {
        state, mode: single.mode, segMode: single.mode, from,
        seg: moved ? computeSegment(single.mode, from, state, n) : null,
      };
    }
    if (replay.active && replay.history[replay.segIndex]) {
      const rs = replay.history[replay.segIndex];
      const state = replayState();
      return { state, mode: rs.mode, segMode: rs.mode, from: rs.from, seg: computeSegment(rs.mode, rs.from, state, n) };
    }
    if (builder.mode && builder.preview) {
      const state = builder.preview;
      return {
        state, mode: builder.mode, segMode: builder.mode, from: sim.current,
        seg: computeSegment(builder.mode, sim.current, state, n),
      };
    }
    const last = sim.history[sim.history.length - 1];
    return { state: sim.current, mode: null, segMode: last ? last.mode : null, from: last ? last.from : null, seg: last || null };
  }

  // ---------- 탭 1: 과정 하나씩 ----------

  function singleRange(mode) {
    if (mode === "isochoric") return { min: init.P0 * 0.3, max: init.P0 * 3, isP: true };
    return { min: init.V0 * 0.5, max: init.V0 * 2, isP: false };
  }

  function syncSingleValue() {
    const r = singleRange(single.mode);
    singleSliderValue.textContent = `${single.target.toFixed(2)} ${r.isP ? "atm" : "L"}`;
  }

  // 처음 상태에서 출발해 기본 목표(가열·팽창)로 움직이도록 해서 고르자마자 변화가 보이게 한다.
  function selectSingle(mode) {
    single.mode = mode;
    singleModeBtns.forEach((b) => b.classList.toggle("active", b.dataset.single === mode));
    const r = singleRange(mode);
    singleSlider.min = r.min;
    singleSlider.max = r.max;
    singleSlider.step = (r.max - r.min) / 200;
    single.cur = r.isP ? init.P0 : init.V0;
    single.target = r.isP ? init.P0 * 1.8 : init.V0 * 1.6;
    singleSlider.value = single.target;
    singleSliderLabel.textContent = r.isP ? "목표 압력 P" : "목표 부피 V";
    syncSingleValue();
    modeTag.textContent = `${MODE_NAMES[mode]} 과정 · 슬라이더로 목표를 정하세요`;
  }

  function tweenSingle(dt) {
    const d = single.target - single.cur;
    const r = singleRange(single.mode);
    if (Math.abs(d) < (r.max - r.min) * 0.0005) {
      single.cur = single.target;
      return;
    }
    single.cur += d * (1 - Math.exp(-dt * 5));
  }

  singleModeBtns.forEach((btn) => btn.addEventListener("click", () => selectSingle(btn.dataset.single)));

  singleSlider.addEventListener("input", () => {
    single.target = Number(singleSlider.value);
    syncSingleValue();
  });

  singleHomeBtn.addEventListener("click", () => {
    const r = singleRange(single.mode);
    single.target = r.isP ? init.P0 : init.V0;
    singleSlider.value = single.target;
    syncSingleValue();
  });

  // ---------- PV graph ----------

  let pvToPx = null;

  function drawPVGrid(ctx, w, h) {
    const padL = 46, padR = 18, padT = 18, padB = 34;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const scaleX = plotW / bounds.Vmax;
    const scaleY = plotH / bounds.Pmax;
    const originX = padL;
    const originY = padT + plotH;

    const toPx = (V, P) => ({ px: originX + V * scaleX, py: originY - P * scaleY });

    const stepX = SimUtils.niceStep(bounds.Vmax);
    const stepY = SimUtils.niceStep(bounds.Pmax);

    ctx.strokeStyle = "#eef0f3";
    ctx.lineWidth = 1;
    ctx.font = "11px JetBrains Mono, monospace";
    ctx.fillStyle = "#8e8e93";

    for (let gx = 0; gx <= bounds.Vmax + 1e-9; gx += stepX) {
      const { px } = toPx(gx, 0);
      ctx.beginPath();
      ctx.moveTo(px, padT);
      ctx.lineTo(px, originY);
      ctx.stroke();
      ctx.fillText(String(Math.round(gx)), px + 2, originY + 14);
    }
    for (let gy = 0; gy <= bounds.Pmax + 1e-9; gy += stepY) {
      const { py } = toPx(0, gy);
      ctx.beginPath();
      ctx.moveTo(padL, py);
      ctx.lineTo(w - padR, py);
      ctx.stroke();
      ctx.fillText(gy.toFixed(gy % 1 === 0 ? 0 : 1), 4, py - 3);
    }

    ctx.strokeStyle = "#a8aab2";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, originY);
    ctx.lineTo(w - padR, originY);
    ctx.stroke();

    ctx.fillStyle = "#8e8e93";
    ctx.font = "10.5px JetBrains Mono, monospace";
    ctx.fillText("V (L)", w - padR - 30, originY + 28);
    ctx.fillText("P (atm)", padL + 6, 11);

    return { toPx };
  }

  function drawCurve(ctx, pts, toPx, color, width, dashed) {
    if (!pts.length) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (dashed) ctx.setLineDash([5, 5]);
    ctx.beginPath();
    pts.forEach((p, i) => {
      const { px, py } = toPx(p.V, p.P);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();
  }

  function drawDirectionArrow(ctx, pts, toPx, color) {
    if (pts.length < 2) return;
    const mid = Math.floor(pts.length / 2);
    const a = toPx(pts[Math.max(0, mid - 1)].V, pts[Math.max(0, mid - 1)].P);
    const b = toPx(pts[Math.min(pts.length - 1, mid + 1)].V, pts[Math.min(pts.length - 1, mid + 1)].P);
    if (Math.hypot(b.px - a.px, b.py - a.py) < 1) return;
    const angle = Math.atan2(b.py - a.py, b.px - a.px);
    const cx = (a.px + b.px) / 2, cy = (a.py + b.py) / 2;
    const size = 6.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.6, size * 0.55);
    ctx.lineTo(-size * 0.6, -size * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function guideCurveFor(mode, state) {
    const V0b = bounds.Vmin, V1b = bounds.Vmax;
    if (mode === "isobaric") {
      return [{ V: V0b, P: state.P }, { V: V1b, P: state.P }];
    }
    if (mode === "isochoric") {
      return [{ V: state.V, P: bounds.Pmin }, { V: state.V, P: bounds.Pmax }];
    }
    if (mode === "isothermal") {
      const nRT = getN() * R * state.T;
      const pts = [];
      for (let i = 0; i <= 60; i++) {
        const V = V0b + ((V1b - V0b) * i) / 60;
        pts.push({ V, P: nRT / V });
      }
      return pts;
    }
    // adiabatic
    const K = state.P * Math.pow(state.V, GAMMA);
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const V = V0b + ((V1b - V0b) * i) / 60;
      pts.push({ V, P: K / Math.pow(V, GAMMA) });
    }
    return pts;
  }

  function drawDot(ctx, p, color, glow) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = glow ? 9 : 0;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.px, p.py, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // 곡선 아래 넓이가 기체가 한 일 W다. 압축이면 W가 음수라 회색으로 칠한다.
  function drawSingleGraph(ctx, toPx, info) {
    const mode = single.mode, from = info.from, cur = info.state, color = MODE_COLORS[mode];
    const guide = guideCurveFor(mode, from);
    drawCurve(ctx, guide, toPx, color, 1.4, true);

    const pts = sampleSegmentCurve(mode, from, cur, getN(), 80);
    const moved = Math.abs(cur.V - from.V) > 1e-6 || Math.abs(cur.P - from.P) > 1e-6;
    const W = info.seg ? info.seg.W : 0;

    if (mode !== "isochoric" && moved) {
      ctx.save();
      ctx.beginPath();
      pts.forEach((p, i) => {
        const { px, py } = toPx(p.V, p.P);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      const e = toPx(cur.V, 0), s = toPx(from.V, 0);
      ctx.lineTo(e.px, e.py);
      ctx.lineTo(s.px, s.py);
      ctx.closePath();
      ctx.fillStyle = W >= 0 ? MODE_FILL[mode] : FILL_COMPRESS;
      ctx.fill();
      ctx.restore();

      const vMid = (cur.V + from.V) / 2;
      const pMean = pts.reduce((a, p) => a + p.P, 0) / pts.length;
      const c = toPx(vMid, pMean / 2);
      ctx.save();
      ctx.fillStyle = "#1d1d1f";
      ctx.textAlign = "center";
      ctx.font = "600 11.5px JetBrains Mono, monospace";
      ctx.fillText("넓이 = |W|", c.px, c.py - 3);
      ctx.fillText(`W = ${W >= 0 ? "+" : "−"}${Math.abs(W).toFixed(2)}`, c.px, c.py + 12);
      ctx.restore();
    } else if (mode === "isochoric") {
      const c = toPx(from.V, (from.P + cur.P) / 2);
      ctx.save();
      ctx.fillStyle = "#1d1d1f";
      ctx.font = "600 11.5px JetBrains Mono, monospace";
      ctx.fillText("넓이 = 0", c.px + 10, c.py - 2);
      ctx.fillText("W = 0", c.px + 10, c.py + 13);
      ctx.restore();
    }

    drawCurve(ctx, pts, toPx, color, 3, false);

    const start = toPx(from.V, from.P);
    ctx.fillStyle = COLOR_REF;
    ctx.beginPath();
    ctx.arc(start.px, start.py, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8e8e93";
    ctx.font = "10px JetBrains Mono, monospace";
    ctx.fillText("처음", start.px + 7, start.py - 7);

    drawDot(ctx, toPx(cur.V, cur.P), color, true);
    dragInfo.classList.add("hidden");
  }

  // 꼭짓점 이름 (교과서 그림 II-19~21의 A→B→C→D). 중심에서 바깥쪽으로 조금 띄워 쓴다.
  function drawVertexLabels(ctx, toPx) {
    if (!sim.history.length) return;
    const names = LABELS[sim.preset] || LABELS.free;
    const pts = sim.history.map((s) => toPx(s.from.V, s.from.P));
    if (!sim.cycleClosed) pts.push(toPx(sim.current.V, sim.current.P));
    const cx = pts.reduce((a, p) => a + p.px, 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p.py, 0) / pts.length;
    ctx.save();
    ctx.fillStyle = COLOR_NEUTRAL;
    ctx.font = "700 13px JetBrains Mono, monospace";
    ctx.textAlign = "center";
    pts.forEach((p, i) => {
      if (!names[i]) return;
      let dx = p.px - cx, dy = p.py - cy;
      const d = Math.hypot(dx, dy);
      if (d < 4) { dx = 1; dy = -1; } else { dx /= d; dy /= d; }
      ctx.fillText(names[i], p.px + dx * 15, p.py + dy * 15 + 4);
    });
    ctx.restore();
  }

  function drawPVGraph(info) {
    const { w, h, ctx } = SimUtils.fitCanvas(pvGraphCanvas);
    ctx.clearRect(0, 0, w, h);
    const { toPx } = drawPVGrid(ctx, w, h);
    pvToPx = toPx;

    if (app.tab === "single") {
      drawSingleGraph(ctx, toPx, info);
      return;
    }

    // 사이클이 닫혔으면 둘러싸인 영역(=W_net)을 먼저 칠해서 과정 선 아래에 깔리게 한다
    if (sim.cycleClosed) {
      ctx.save();
      ctx.beginPath();
      sim.history.forEach((seg, i) => {
        const pts = sampleSegmentCurve(seg.mode, seg.from, seg.to, getN());
        pts.forEach((p, j) => {
          const { px, py } = toPx(p.V, p.P);
          if (i === 0 && j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
      });
      ctx.closePath();
      ctx.fillStyle = COLOR_CYCLE_FILL;
      ctx.fill();
      ctx.restore();
    }

    // 기준점 (P0, V0)
    const ref = toPx(init.V0, init.P0);
    ctx.fillStyle = sim.cycleClosed ? COLOR_NEUTRAL : COLOR_REF;
    ctx.beginPath();
    ctx.arc(ref.px, ref.py, sim.cycleClosed ? 5.5 : 4, 0, Math.PI * 2);
    ctx.fill();
    if (!sim.cycleClosed) {
      ctx.fillStyle = "#8e8e93";
      ctx.font = "10px JetBrains Mono, monospace";
      ctx.fillText("기준점", ref.px + 7, ref.py + 3);
    }

    // 두 번째 과정부터: 기준점 근처로 오면 스냅된다는 것을 점선 원으로 안내
    if (sim.history.length >= 1 && !sim.cycleClosed) {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = COLOR_NEUTRAL;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(ref.px, ref.py, SNAP_PX, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 지금까지 확정된 과정 (색상별 실선 + 진행 방향 화살표)
    sim.history.forEach((seg) => {
      const pts = sampleSegmentCurve(seg.mode, seg.from, seg.to, getN());
      drawCurve(ctx, pts, toPx, MODE_COLORS[seg.mode], 2.5, false);
      drawDirectionArrow(ctx, pts, toPx, MODE_COLORS[seg.mode]);
    });

    drawVertexLabels(ctx, toPx);

    // 빌더에서 모드를 고른 상태 - 안내 곡선(점선) + 진행 중인 구간(굵은 선)
    if (builder.mode && builder.preview && !replay.active) {
      const guide = guideCurveFor(builder.mode, sim.current);
      drawCurve(ctx, guide, toPx, MODE_COLORS[builder.mode], 1.5, true);
      const segPts = sampleSegmentCurve(builder.mode, sim.current, builder.preview, getN());
      drawCurve(ctx, segPts, toPx, MODE_COLORS[builder.mode], 3, false);
    }

    const s = info.state;
    const cp = toPx(s.V, s.P);
    const color = builder.mode ? MODE_COLORS[builder.mode] : COLOR_NEUTRAL;
    drawDot(ctx, cp, color, builder.mode || replay.active);

    if (builder.mode && builder.preview && !replay.active) {
      dragInfo.innerHTML =
        `P = ${s.P.toFixed(2)}<small>atm</small><br>` +
        `V = ${s.V.toFixed(2)}<small>L</small><br>` +
        `T = ${s.T.toFixed(1)}<small>K</small>` +
        (builder.willClose ? `<br>기준점 — 확정하면 사이클 완성` : "");
      dragInfo.style.left = `${cp.px}px`;
      dragInfo.style.top = `${cp.py}px`;
      dragInfo.classList.remove("hidden");
    } else {
      dragInfo.classList.add("hidden");
    }
  }

  function getExpRatio() {
    return num(expInput);
  }

  function getColdRatio() {
    return num(coldInput);
  }

  // ---------- 입자 + 피스톤 모형 ----------

  const ps = { list: [], H: null, kick: 0 };

  function hueOf(T) {
    const Tref = tempOf(init.P0, init.V0, getN());
    const t = clamp((T / Tref - 0.5) / 1.5, 0, 1);
    return 220 - t * 220; // 220(blue)→0(red)
  }

  function pistonGeometry(w, h, V) {
    const cylW = Math.min(w * 0.46, 240);
    const cylX = w / 2 - cylW / 2;
    const topY = 84;
    const botY = h - 70;
    const cylH = botY - topY;
    const vFrac = clamp(V / bounds.Vmax, 0, 1);
    return { cylW, cylX, topY, botY, cylH, pistonY: botY - vFrac * cylH };
  }

  function gauss() {
    return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  }

  // 벽·피스톤과 탄성 충돌한다. 움직이는 피스톤에 부딪히면 속력이 바뀐다(밀면 빨라지고 물러나면 느려진다).
  // 입자 수가 적고 2차원이라 기체 전체의 온도는 모델의 T에 맞춰 천천히 보정한다.
  function updateParticles(dt, info) {
    const w = pistonCanvas.clientWidth, h = pistonCanvas.clientHeight;
    if (!w || !h) return;
    const g = pistonGeometry(w, h, info.state.V);
    const W = g.cylW - 4;
    const H = Math.max(8, g.botY - 2 - g.pistonY);
    const Tref = tempOf(init.P0, init.V0, getN());
    const vrms = V_REF * Math.sqrt(Math.max(info.state.T, 1) / Tref);

    if (!ps.list.length) {
      for (let i = 0; i < NP; i++) {
        ps.list.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (gauss() * vrms) / Math.SQRT2, vy: (gauss() * vrms) / Math.SQRT2,
        });
      }
    }

    const u = ps.H == null ? 0 : clamp((H - ps.H) / dt, -300, 300);
    ps.H = H;

    const steps = Math.max(1, Math.ceil(dt * 120));
    const hdt = dt / steps;
    let hits = 0;
    for (let s = 0; s < steps; s++) {
      for (const p of ps.list) {
        p.x += p.vx * hdt;
        p.y += p.vy * hdt;
        if (p.x < 0) { p.x = -p.x; p.vx = -p.vx; }
        else if (p.x > W) { p.x = 2 * W - p.x; p.vx = -p.vx; }
        if (p.y < 0) { p.y = -p.y; p.vy = -p.vy; }
        if (p.y > H) { p.y = 2 * H - p.y; p.vy = 2 * u - p.vy; hits++; }
        p.x = clamp(p.x, 0, W);
        p.y = clamp(p.y, 0, H);
      }
    }
    ps.kick = (ps.kick + hits) * Math.exp(-dt * 18);

    let ke = 0;
    for (const p of ps.list) ke += p.vx * p.vx + p.vy * p.vy;
    ke /= ps.list.length;
    if (ke > 1e-6) {
      const sc = Math.sqrt((vrms * vrms) / ke);
      const k = 1 + (sc - 1) * Math.min(1, dt * 3);
      for (const p of ps.list) { p.vx *= k; p.vy *= k; }
    }
  }

  function arrowV(ctx, x, yFrom, yTo, color, alpha) {
    const dir = yTo >= yFrom ? 1 : -1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, yFrom);
    ctx.lineTo(x, yTo - dir * 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, yTo);
    ctx.lineTo(x - 6, yTo - dir * 9);
    ctx.lineTo(x + 6, yTo - dir * 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPiston(info) {
    const { w, h, ctx } = SimUtils.fitCanvas(pistonCanvas);
    ctx.clearRect(0, 0, w, h);

    const s = info.state, mode = info.mode;
    const g = pistonGeometry(w, h, s.V);
    const { cylW, cylX, topY, botY, pistonY } = g;
    const hue = hueOf(s.T);

    // 기체 영역 (온도색)
    ctx.fillStyle = `hsla(${hue}, 80%, 62%, 0.26)`;
    ctx.fillRect(cylX + 2, pistonY, cylW - 4, botY - pistonY - 2);

    // 실린더 벽
    ctx.strokeStyle = "#8e8e93";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cylX, topY);
    ctx.lineTo(cylX, botY);
    ctx.lineTo(cylX + cylW, botY);
    ctx.lineTo(cylX + cylW, topY);
    ctx.stroke();

    // 입자
    ctx.fillStyle = `hsl(${hue}, 85%, 46%)`;
    for (const p of ps.list) {
      ctx.beginPath();
      ctx.arc(cylX + 2 + p.x, botY - 2 - p.y, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 피스톤 (입자가 부딪히면 살짝 밀려 오른다)
    const off = Math.min(3, ps.kick * 0.25);
    ctx.fillStyle = "#45515e";
    ctx.fillRect(cylX - 4, pistonY - 8 - off, cylW + 8, 8);
    ctx.fillRect(w / 2 - 4, topY - 26, 8, pistonY - topY + 26 - 8 - off);

    // 단열: 벽에 해칭(단열재) 표시
    if (mode === "adiabatic") {
      ctx.save();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.5;
      for (let y = topY; y < botY; y += 10) {
        ctx.beginPath();
        ctx.moveTo(cylX - 10, y);
        ctx.lineTo(cylX - 2, y + 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cylX + cylW + 2, y);
        ctx.lineTo(cylX + cylW + 10, y + 8);
        ctx.stroke();
      }
      ctx.fillStyle = "#ef4444";
      ctx.font = "11px JetBrains Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText("단열재 · 열 출입 없음", cylX + cylW / 2, botY + 24);
      ctx.restore();
    }

    // 등적: 피스톤 고정 핀
    if (mode === "isochoric") {
      ctx.fillStyle = "#0ea5e9";
      ctx.beginPath();
      ctx.arc(cylX - 4, pistonY - 4, 4, 0, Math.PI * 2);
      ctx.arc(cylX + cylW + 4, pistonY - 4, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 등압: 추(무게) 표시
    if (mode === "isobaric") {
      ctx.fillStyle = "#f59e0b";
      const wgtW = cylW * 0.45;
      ctx.fillRect(w / 2 - wgtW / 2, topY - 46, wgtW, 18);
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px JetBrains Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText("추", w / 2, topY - 33);
      ctx.textAlign = "left";
    }

    // 열의 출입: 열원(또는 열저장체)과 화살표. 흡수는 위로(빨강), 방출은 아래로(파랑)
    if (mode && mode !== "adiabatic") {
      const Q = info.seg ? info.seg.Q : 0;
      const hot = Q > 1e-3, cold = Q < -1e-3, iso = mode === "isothermal";
      if (iso || hot || cold) {
        const boxY = botY + 44, boxH = 20;
        const edge = iso ? "#10b981" : hot ? "#ef4444" : "#0ea5e9";
        const fill = iso ? "#dcfce7" : hot ? "#fee2e2" : "#e0f2fe";
        ctx.save();
        ctx.fillStyle = fill;
        ctx.strokeStyle = edge;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.rect(cylX, boxY, cylW, boxH);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = edge;
        ctx.font = "11px JetBrains Mono, monospace";
        ctx.textAlign = "center";
        ctx.fillText(iso ? "열저장체 (T 일정)" : hot ? "열원 · 열 흡수" : "냉각 · 열 방출", cylX + cylW / 2, boxY + 14);
        ctx.restore();
        if (hot || cold) {
          const alpha = 0.45 + 0.55 * clamp(Math.abs(Q) / (0.15 * energyScale(info)), 0, 1);
          [0.2, 0.5, 0.8].forEach((f) => {
            const x = cylX + cylW * f;
            if (hot) arrowV(ctx, x, boxY - 2, botY + 6, "#ef4444", alpha);
            else arrowV(ctx, x, botY + 6, boxY - 2, "#0ea5e9", alpha);
          });
        }
      }
    }

  }

  // ---------- Q · W · ΔU 막대 ----------

  function energyScale(info) {
    let m = 3.4 * init.P0 * init.V0;
    if (app.tab === "cycle") {
      sim.history.forEach((sg) => {
        m = Math.max(m, Math.abs(sg.Q), Math.abs(sg.W), Math.abs(sg.dU));
      });
      if (info && info.seg) m = Math.max(m, Math.abs(info.seg.Q), Math.abs(info.seg.W), Math.abs(info.seg.dU));
    }
    return m * 1.05;
  }

  const fmtS = (v) => `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`;
  const fmtP = (v) => (v < 0 ? `(−${Math.abs(v).toFixed(2)})` : Math.abs(v).toFixed(2));
  const EPS_E = 5e-3;
  const f2 = (v) => (Math.abs(v) < EPS_E ? 0 : v).toFixed(2);

  function drawEnergy(info) {
    const { w, h, ctx } = SimUtils.fitCanvas(energyCanvas);
    ctx.clearRect(0, 0, w, h);

    const seg = info.seg;
    const vals = seg ? [seg.Q, seg.W, seg.dU] : [0, 0, 0];
    const names = ["Q", "W", "ΔU"];
    const colors = [COLOR_Q, COLOR_W, COLOR_U];
    const sign = (v, pos, neg) => (v > EPS_E ? pos : v < -EPS_E ? neg : "0");
    const words = [sign(vals[0], "흡수", "방출"), sign(vals[1], "팽창", "압축"), sign(vals[2], "온도 ↑", "온도 ↓")];

    const top = 18, bottomArea = 66;
    const plotH = h - top - bottomArea;
    const mid = top + plotH / 2;
    const half = plotH / 2 - 14;
    const scale = energyScale(info);
    const colW = w / 3;
    const bw = Math.min(38, colW * 0.5);

    ctx.strokeStyle = "#a8aab2";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(6, mid);
    ctx.lineTo(w - 6, mid);
    ctx.stroke();

    ctx.textAlign = "center";
    for (let i = 0; i < 3; i++) {
      const cx = colW * i + colW / 2;
      const v = Math.abs(vals[i]) < EPS_E ? 0 : vals[i];
      const len = clamp(v / scale, -1, 1) * half;
      ctx.fillStyle = colors[i];
      if (len !== 0) ctx.fillRect(cx - bw / 2, len >= 0 ? mid - len : mid, bw, Math.abs(len));
      ctx.font = "700 11.5px JetBrains Mono, monospace";
      const ty = len > 0 ? mid - len - 6 : len < 0 ? mid - len + 15 : mid - 6;
      ctx.fillText(v === 0 ? "0" : fmtS(v), cx, ty);

      ctx.font = "700 13px JetBrains Mono, monospace";
      ctx.fillText(names[i], cx, h - bottomArea + 18);
      ctx.fillStyle = "#8e8e93";
      ctx.font = "11px JetBrains Mono, monospace";
      ctx.fillText(words[i], cx, h - bottomArea + 34);
    }

    ctx.fillStyle = "#45515e";
    ctx.font = "10.5px JetBrains Mono, monospace";
    ctx.fillText(
      seg ? `${fmtS(vals[0])} = ${fmtS(vals[2])} + ${fmtP(vals[1])}` : "과정을 진행해 보세요",
      w / 2, h - 8
    );
  }

  // ---------- Render ----------

  function render(info) {
    const d = info || displayInfo();
    drawPiston(d);
    drawPVGraph(d);
    drawEnergy(d);
    updateRecorder(d);
    updateCycleRecorder();
  }

  const setHTML = (node, html) => {
    if (node._h !== html) {
      node._h = html;
      node.innerHTML = html;
    }
  };
  const setText = (node, text) => {
    if (node._t !== text) {
      node._t = text;
      node.textContent = text;
    }
  };

  function updateCycleRecorder() {
    if (app.tab !== "cycle" || !sim.cycleClosed || !sim.cycleStats) {
      recorderCycle.classList.add("hidden");
      return;
    }
    recorderCycle.classList.remove("hidden");
    const { Wnet, Qin, Qout, eta } = sim.cycleStats;
    setHTML(valWnet, `${Wnet.toFixed(2)}<small>L·atm</small>`);
    setHTML(valQin, `${Qin.toFixed(2)}<small>L·atm</small>`);
    setHTML(valQout, `${Qout.toFixed(2)}<small>L·atm</small>`);
    setText(valEta, Qin > 0 ? `${(eta * 100).toFixed(1)}%` : "–");
    setText(cycleCheck, `${Wnet.toFixed(2)} ≈ ${(Qin - Qout).toFixed(2)} (Q_in − Q_out)`);
    recDotCycle.classList.toggle("live", replay.active);
  }

  // ---------- Recorder ----------

  function updateRecorder(info) {
    const s = info.state;
    setHTML(valP, `${s.P.toFixed(2)}<small>atm</small>`);
    setHTML(valV, `${s.V.toFixed(2)}<small>L</small>`);
    setHTML(valT, `${s.T.toFixed(1)}<small>K</small>`);
    setHTML(valN, `${getN().toFixed(2)}<small>mol</small>`);
    const moving = app.tab === "single" ? Math.abs(single.target - single.cur) > 1e-3 : !!builder.mode || replay.active;
    recDot.classList.toggle("live", moving);
    recDotProcess.classList.toggle("live", moving);

    setText(procTitle, app.tab === "single" || builder.mode || replay.active ? "이 과정" : "마지막 과정");

    const seg = info.seg;
    if (!seg) {
      setText(procName, "–");
      setText(procDelta, "–");
      setHTML(procW, "–");
      setHTML(procQ, "–");
      setHTML(procDU, "–");
      setText(procCheck, "ΔU = Q − W");
      return;
    }
    setText(procName, processLabel(info.segMode, seg.dV, seg.dP));
    setText(
      procDelta,
      `${seg.dV >= 0 ? "+" : ""}${seg.dV.toFixed(2)}L / ` +
        `${seg.dP >= 0 ? "+" : ""}${seg.dP.toFixed(2)}atm / ` +
        `${seg.dT >= 0 ? "+" : ""}${seg.dT.toFixed(1)}K`
    );
    setHTML(procW, `${f2(seg.W)}<small>L·atm</small>`);
    setHTML(procQ, `${f2(seg.Q)}<small>L·atm</small>`);
    setHTML(procDU, `${f2(seg.dU)}<small>L·atm</small>`);
    setText(procCheck, `${f2(seg.dU)} = ${f2(seg.Q)} − ${f2(seg.W)}`);
  }

  // ---------- Builder interaction ----------

  function updateBuilderPreview() {
    if (!builder.mode) return;
    const n = getN();
    const freeVal = Number(builderSlider.value);
    let preview = computeModeState(builder.mode, sim.current, freeVal, n);

    builder.willClose = false;
    if (sim.history.length >= 1 && pvToPx && canReachStart(builder.mode, sim.current, n)) {
      const p1 = pvToPx(preview.V, preview.P);
      const p0 = pvToPx(init.V0, init.P0);
      if (Math.hypot(p1.px - p0.px, p1.py - p0.py) <= SNAP_PX) {
        preview = { P: init.P0, V: init.V0, T: tempOf(init.P0, init.V0, n) };
        builder.willClose = true;
      }
    }

    builder.preview = preview;
    builderSliderValue.textContent =
      builder.mode === "isochoric" ? `${preview.P.toFixed(2)} atm` : `${preview.V.toFixed(2)} L`;
    builderCloseHint.classList.toggle("hidden", !builder.willClose);

    const moved = Math.abs(preview.V - sim.current.V) > 1e-4 || Math.abs(preview.P - sim.current.P) > 1e-4;
    confirmStepBtn.disabled = !moved;
    render();
  }

  function selectMode(mode) {
    builder.mode = mode;
    modeButtons.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));

    if (mode === "isochoric") {
      builderSlider.min = bounds.Pmin;
      builderSlider.max = bounds.Pmax;
      builderSlider.step = (bounds.Pmax - bounds.Pmin) / 300;
      builderSlider.value = sim.current.P;
      builderSliderLabel.textContent = "목표 압력 P";
    } else {
      builderSlider.min = bounds.Vmin;
      builderSlider.max = bounds.Vmax;
      builderSlider.step = (bounds.Vmax - bounds.Vmin) / 300;
      builderSlider.value = sim.current.V;
      builderSliderLabel.textContent = "목표 부피 V";
    }
    builderSliderWrap.classList.remove("hidden");
    modeTag.textContent = `${MODE_NAMES[mode]} 모드 · 슬라이더로 목표를 정하세요`;
    updateBuilderPreview();
  }

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (builder.mode === mode) {
        cancelBuilder();
        modeTag.textContent = cycleTagText();
        render();
        return;
      }
      selectMode(mode);
    });
  });

  builderSlider.addEventListener("input", updateBuilderPreview);

  confirmStepBtn.addEventListener("click", () => {
    if (!builder.mode || !builder.preview || confirmStepBtn.disabled) return;
    const from = sim.current;
    const to = builder.preview;
    const willClose = builder.willClose;
    const seg = computeSegment(builder.mode, from, to, getN());
    sim.history.push({ mode: builder.mode, from, to, ...seg });
    sim.current = to;
    cancelBuilder();
    if (sim.history.length >= 2 && willClose) {
      closeCycle();
    } else {
      modeTag.textContent = cycleTagText();
    }
    render();
  });

  undoBtn.addEventListener("click", () => {
    if (!sim.history.length || replay.active) return;
    const last = sim.history.pop();
    sim.current = last.from;
    sim.cycleClosed = false;
    sim.cycleStats = null;
    cancelBuilder();
    loopBtn.disabled = true;
    replay.loop = false;
    loopBtn.classList.remove("active");
    loopBtn.textContent = "반복재생";
    modeTag.textContent = cycleTagText();
    render();
  });

  // ---------- Presets ----------

  // 교과서 그림 II-19~21의 기호를 따른다. A→B→C→D→A 순서로 한 번의 순환 과정이다.
  function presetLegs(kind, n) {
    const P0 = init.P0, V0 = init.V0;
    const T0 = tempOf(P0, V0, n);
    const at = (P, V) => ({ P, V, T: tempOf(P, V, n) });

    if (kind === "stirling" || kind === "carnot") {
      const V1 = V0 * getExpRatio();
      const Tc = T0 * getColdRatio();
      const P1 = (n * R * T0) / V1;
      if (kind === "stirling") {
        const P2 = P1 * (Tc / T0);
        const P3 = (n * R * Tc) / V0;
        return [
          { mode: "isothermal", from: { P: P0, V: V0, T: T0 }, to: { P: P1, V: V1, T: T0 } },
          { mode: "isochoric", from: { P: P1, V: V1, T: T0 }, to: { P: P2, V: V1, T: Tc } },
          { mode: "isothermal", from: { P: P2, V: V1, T: Tc }, to: { P: P3, V: V0, T: Tc } },
          { mode: "isochoric", from: { P: P3, V: V0, T: Tc }, to: { P: P0, V: V0, T: T0 } },
        ];
      }
      const ratio = Math.pow(T0 / Tc, 1 / (GAMMA - 1));
      const V4 = V0 * ratio;
      const V2 = V1 * ratio;
      const P2 = (n * R * Tc) / V2;
      const P4 = (n * R * Tc) / V4;
      return [
        { mode: "isothermal", from: { P: P0, V: V0, T: T0 }, to: { P: P1, V: V1, T: T0 } },
        { mode: "adiabatic", from: { P: P1, V: V1, T: T0 }, to: { P: P2, V: V2, T: Tc } },
        { mode: "isothermal", from: { P: P2, V: V2, T: Tc }, to: { P: P4, V: V4, T: Tc } },
        { mode: "adiabatic", from: { P: P4, V: V4, T: Tc }, to: { P: P0, V: V0, T: T0 } },
      ];
    }

    // 가솔린·디젤: A는 단열 압축이 끝난 점(부피 최소). 압축비 r = V_max / V_min.
    if (kind === "gasoline") {
      const r = num(gasRInput), k = num(gasKInput);
      const Vmax = V0 * r, rg = Math.pow(r, GAMMA);
      const A = at(P0, V0), B = at(P0 * k, V0);
      const C = at((P0 * k) / rg, Vmax), D = at(P0 / rg, Vmax);
      return [
        { mode: "isochoric", from: A, to: B },
        { mode: "adiabatic", from: B, to: C },
        { mode: "isochoric", from: C, to: D },
        { mode: "adiabatic", from: D, to: A },
      ];
    }
    const r = num(dslRInput), rho = Math.min(num(dslCInput), r * 0.9);
    const Vmax = V0 * r, rg = Math.pow(r, GAMMA);
    const A = at(P0, V0), B = at(P0, V0 * rho);
    const C = at(P0 * Math.pow(rho / r, GAMMA), Vmax), D = at(P0 / rg, Vmax);
    return [
      { mode: "isobaric", from: A, to: B },
      { mode: "adiabatic", from: B, to: C },
      { mode: "isochoric", from: C, to: D },
      { mode: "adiabatic", from: D, to: A },
    ];
  }

  function generatePreset(kind) {
    recomputeBounds();
    const n = getN();
    const legs = presetLegs(kind, n);

    fitBoundsToPoints(legs.flatMap((leg) => [leg.from, leg.to]));

    sim.history = legs.map((leg) => ({ mode: leg.mode, from: leg.from, to: leg.to, ...computeSegment(leg.mode, leg.from, leg.to, n) }));
    sim.current = legs[legs.length - 1].to;
    cancelBuilder();
    closeCycle();
    render();

    replay.loop = true;
    loopBtn.classList.add("active");
    loopBtn.textContent = "반복 중";
    loopBtn.disabled = false;
    startReplay();
  }

  presetButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.preset;
      if (sim.preset === kind) return;
      sim.preset = kind;
      setPresetUI(kind);
      if (kind === "free") {
        resetState();
      } else {
        stopReplay();
        generatePreset(kind);
      }
    });
  });

  // ---------- Reset / Replay ----------

  resetBtn.addEventListener("click", () => {
    sim.preset = "free";
    setPresetUI("free");
    resetState();
  });

  function replayState() {
    const seg = replay.history[replay.segIndex];
    if (!seg) return sim.current;
    const pts = sampleSegmentCurve(seg.mode, seg.from, seg.to, getN(), 60);
    const idx = Math.min(pts.length - 1, Math.floor(replay.t * pts.length));
    const p = pts[idx];
    return { P: p.P, V: p.V, T: tempOf(p.P, p.V, getN()) };
  }

  function advanceReplay(ts) {
    if (replay.segStart == null) replay.segStart = ts;
    replay.t = Math.min(1, (ts - replay.segStart) / replay.duration);
    if (replay.t < 1) return;
    replay.segIndex++;
    replay.segStart = null;
    replay.t = 0;
    if (replay.segIndex >= replay.history.length) {
      if (replay.loop && sim.cycleClosed) {
        replay.segIndex = 0;
      } else {
        stopReplay();
      }
    }
  }

  function startReplay() {
    if (!sim.history.length || builder.mode) return;
    replay.active = true;
    replay.history = sim.history.slice();
    replay.segIndex = 0;
    replay.segStart = null;
    replay.t = 0;
    replayBtn.textContent = "정지";
    setControlsLocked(true);
  }

  function stopReplay() {
    replay.active = false;
    replayBtn.textContent = "재생";
    setControlsLocked(false);
    render();
  }

  replayBtn.addEventListener("click", () => {
    if (replay.active) {
      stopReplay();
      return;
    }
    startReplay();
  });

  loopBtn.addEventListener("click", () => {
    if (loopBtn.disabled) return;
    replay.loop = !replay.loop;
    loopBtn.classList.toggle("active", replay.loop);
    loopBtn.textContent = replay.loop ? "반복 중" : "반복재생";
  });

  // ---------- Tabs ----------

  function setTab(tab) {
    if (app.tab === tab) return;
    app.tab = tab;
    tabButtons.forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
    singleBar.classList.toggle("hidden", tab !== "single");
    cycleBar.classList.toggle("hidden", tab !== "cycle");
    intro.textContent = INTRO[tab];
    if (replay.active) stopReplay();
    cancelBuilder();
    syncEngineGroups();

    if (tab === "single") {
      applyBounds();
      selectSingle(single.mode);
      render();
    } else if (sim.preset !== "free") {
      generatePreset(sim.preset);
    } else {
      applyBounds();
      modeTag.textContent = cycleTagText();
      render();
    }
  }

  tabButtons.forEach((btn) => btn.addEventListener("click", () => setTab(btn.dataset.tab)));

  // ---------- Settings ----------

  function syncLabels() {
    p0Value.textContent = `${Number(p0Input.value).toFixed(1)} atm`;
    v0Value.textContent = `${Number(v0Input.value).toFixed(1)} L`;
    nValue.textContent = `${Number(nInput.value).toFixed(2)} mol`;
    const t0 = tempOf(Number(p0Input.value), Number(v0Input.value), Number(nInput.value));
    t0Hint.textContent = `초기 온도 T0 ≈ ${t0.toFixed(1)} K (P0V0=nRT0으로 자동 계산)`;
  }

  function syncPresetLabels() {
    expValue.textContent = `${num(expInput).toFixed(1)}배`;
    coldValue.textContent = `${num(coldInput).toFixed(2)} × T_hot`;
    gasRValue.textContent = `${num(gasRInput).toFixed(1)}배`;
    gasKValue.textContent = `${num(gasKInput).toFixed(1)}배`;
    dslRValue.textContent = `${num(dslRInput).toFixed(1)}배`;
    dslCValue.textContent = `${num(dslCInput).toFixed(1)}배`;
  }

  function applyInitFromInputs() {
    init.P0 = Number(p0Input.value);
    init.V0 = Number(v0Input.value);
    init.n = Number(nInput.value);
    sim.preset = "free";
    setPresetUI("free");
    resetState();
    if (app.tab === "single") selectSingle(single.mode);
  }

  [p0Input, v0Input, nInput].forEach((input) => {
    input.addEventListener("input", () => {
      syncLabels();
      applyInitFromInputs();
    });
  });

  [expInput, coldInput, gasRInput, gasKInput, dslRInput, dslCInput].forEach((input) => {
    input.addEventListener("input", () => {
      syncPresetLabels();
      if (app.tab === "cycle" && sim.preset !== "free") {
        stopReplay();
        generatePreset(sim.preset);
      }
    });
  });

  function openSettings() { settingsOverlay.classList.remove("hidden"); }
  function closeSettings() { settingsOverlay.classList.add("hidden"); }

  settingsToggle.addEventListener("click", openSettings);
  settingsClose.addEventListener("click", closeSettings);
  settingsBackdrop.addEventListener("click", closeSettings);

  window.addEventListener("resize", () => render());

  // ---------- Loop ----------

  let lastTs = null;

  function loop(ts) {
    const dt = lastTs == null ? 1 / 60 : clamp((ts - lastTs) / 1000, 0.001, 0.05);
    lastTs = ts;
    if (replay.active) advanceReplay(ts);
    if (app.tab === "single") tweenSingle(dt);
    const info = displayInfo();
    updateParticles(dt, info);
    render(info);
    requestAnimationFrame(loop);
  }

  // ---------- Init ----------

  syncLabels();
  syncPresetLabels();
  intro.textContent = INTRO.single;
  applyInitFromInputs();
  selectSingle("isobaric");
  requestAnimationFrame(loop);
})();
