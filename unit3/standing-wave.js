/* ============================================================
   정상파
   교과서: (동아출판) 역학과 에너지 pp.118~123 「05 정상파」
   성취기준: [12역학03-05]

   1 정상파의 형성  반대로 가는 두 파동이 겹쳐 마디와 배가 생긴다            (p.118 그림 III-27·28)
   2 현악기         양 끝이 고정된 줄 — 줄 길이·장력·굵기와 진동수             (p.120 그림 III-29~31)
   3 관악기         양쪽 열린 관과 한쪽 닫힌 관의 정상파                       (p.121 그림 III-32~36)
   4 탐구           반사판 앞에서 음속 재기 (p.119), 공명관 (p.122 해 보기)

   ※ 마디 간격·파장·진동수는 공식으로 띄우지 않는다. 그려진 정상파의 모양에서
      마디(거의 안 움직이는 곳)와 배(가장 크게 움직이는 곳)를 찾아 그 간격으로 잰다.
      공식값은 비교용으로 따로 계산한다.
   ※ 화면은 천천히 돌리고, 소리는 실제 진동수로 낸다.
   ※ 탐구 탭의 소리 크기는 반사판 앞 마이크, 눈금실린더 입구의 소리를 흉내 낸 값이다.
      관 끝 보정은 교과서처럼 무시한다.
   ============================================================ */

(() => {
  "use strict";

  /* ---------------------------------------------------------
     캔버스에 직접 그리는 색.
     CSS의 변수와는 별개의 하드코딩 상수다.
     색을 바꿀 때는 standing-wave.css와 여기를 함께 고쳐야 한다.
     --------------------------------------------------------- */
  const COLOR_STAGE = "#ffffff";
  const COLOR_INK   = "#171717";
  const COLOR_BODY  = "#4d4d4d";
  const COLOR_MUTE  = "#8f8f8f";
  const COLOR_PAPER = "#fafafa";
  const COLOR_R     = "#0070f3";   // 오른쪽으로 가는 파동
  const COLOR_L     = "#e5620a";   // 왼쪽으로 가는 파동
  const COLOR_NODE  = "#dc2626";   // 마디
  const COLOR_BELLY = "#16a34a";   // 배
  const COLOR_MARK  = "#7928ca";   // 직접 표시한 자리
  const COLOR_WATER = "#cfe6fb";

  const WINDOW_W = 4;              // 탭 1 화면에 담기는 길이 (m)
  const MU0 = 0.0004;              // 탭 2 가장 가는 줄의 선밀도 (kg/m)
  const Q = 20;                    // 탭 2 공명이 얼마나 뾰족한가
  const MODES = 8;
  const PEAK_MIN = 0.5;            // 이만큼은 크게 흔들려야 마디·배를 잰다
  const V_SOUND = 340;             // 탭 3 음속 (m/s)
  const PLATE_D = 0.3;             // 탭 4 스피커에서 반사판까지 (m)
  const R_REFL = 0.85;             // 반사판이 되돌리는 정도
  const TUBE_H = 0.8;              // 탭 4 눈금실린더 길이 (m)
  const BIN = 0.005;               // 탭 4 소리 크기를 적는 간격 (m)
  const VOL = 0.09;
  const TOP = 54;                  // 무대 위쪽 여백 — 왼쪽 위 상태 표시와 겹치지 않게

  const $ = (id) => document.getElementById(id);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const TAU = 2 * Math.PI;

  const state = {
    tab: 1,
    paused: false,
    period: 3,           // 한 번 진동하는 데 걸리는 화면 시간 (s)
    cyc: 0,              // 진동 횟수 (주기 단위)
    sound: false,
    lam1: 1.2,           // 탭 1 파장 (m)
    marks1: true,
    mode2: "pick",       // 탭 2 — "pick" 진동 고르기 | "seek" 진동수 찾기
    n2: 2,
    L2: 0.6,
    T2: 60,
    thick2: 1,
    f2: 200,
    rec2: {},            // 찾아서 기록한 진동수 { 배의 수: Hz }
    type3: "open",       // 탭 3 — "open" 양쪽 열린 관 | "closed" 한쪽 닫힌 관
    idx3: 2,
    L3: 0.6,
    ex4: "plate",        // 탭 4 — "plate" 반사판 | "tube" 공명관
    show4: false,
    f4p: 2300,
    f4t: 512,
    temp: 15,
    x4: 0.15,            // 마이크의 위치 — 스피커에서 (m)
    h4: 0.3,             // 물 높이 — 바닥에서 (m)
    marksP: [], marksT: [],
    traceP: [], traceT: [],
    prevP: null, prevT: null,
  };

  let canvas = null;
  let cardEls = [];
  let models = null;
  let hit = null;        // 이번 프레임에 끌 수 있는 자리

  /* ---------------------------------------------------------
     측정 — 그려진 정상파에서 마디와 배를 찾는다
     --------------------------------------------------------- */
  const cache = {};
  function cached(name, key, fn) {
    const c = cache[name];
    if (c && c.key === key) return c.val;
    const val = fn();
    cache[name] = { key, val };
    return val;
  }

  // env(x): 그 자리가 흔들리는 크기. ends: 양 끝이 [마디 "N" | 배 "A" | 없음 null]
  function analyze(env, len, ends) {
    const N = 800;
    const e = new Float64Array(N + 1);
    let peak = 0;
    let lo = Infinity;
    for (let i = 0; i <= N; i++) {
      e[i] = env((i / N) * len);
      peak = Math.max(peak, e[i]);
      lo = Math.min(lo, e[i]);
    }
    if (peak < PEAK_MIN) return null;
    const norm = (v) => (v - lo) / (peak - lo);
    const nodes = [];
    const bellies = [];
    // 이웃한 자리보다 작으면 마디 후보, 크면 배 후보 — 끝에서 창 하나 안쪽은 끝 조건으로 센다
    const w = Math.max(3, Math.round(N / 60));
    for (let i = w; i <= N - w; i++) {
      let isMax = true;
      let isMin = true;
      for (let j = 1; j <= w; j++) {
        if (e[i - j] >= e[i] || e[i + j] > e[i]) isMax = false;
        if (e[i - j] <= e[i] || e[i + j] < e[i]) isMin = false;
      }
      if (isMax && norm(e[i]) > 0.5) bellies.push((i / N) * len);
      if (isMin && norm(e[i]) < 0.25) nodes.push((i / N) * len);
    }
    ends.forEach((t, i) => {
      if (t) (t === "N" ? nodes : bellies).push(i ? len : 0);
    });
    nodes.sort((a, b) => a - b);
    bellies.sort((a, b) => a - b);
    const all = [...nodes, ...bellies].sort((a, b) => a - b);
    // 마디와 이웃한 배 사이는 λ/4
    const lam = all.length >= 2 ? (4 * (all[all.length - 1] - all[0])) / (all.length - 1) : null;
    const gap = nodes.length >= 2 ? (nodes[nodes.length - 1] - nodes[0]) / (nodes.length - 1) : null;
    return { nodes, bellies, lam, gap };
  }

  // 0을 아래에서 위로 지나는 자리들 — 파동의 한 파장을 잰다
  function upCross(fn, len) {
    const N = 800;
    const out = [];
    let prev = fn(0);
    for (let i = 1; i <= N; i++) {
      const cur = fn((i / N) * len);
      if (prev < 0 && cur >= 0) out.push((((i - 1) + -prev / (cur - prev)) / N) * len);
      prev = cur;
    }
    return out;
  }

  /* ---------------------------------------------------------
     모형 — 탭마다 지금 설정에서 정상파의 모양과 진동수
     --------------------------------------------------------- */
  const vAir = () => 331 + 0.6 * state.temp;

  // 탭 1 — 오른쪽·왼쪽으로 가는 같은 파동. 합이 정상파
  const yRight = (x, cyc) => Math.sin((TAU * x) / state.lam1 - TAU * cyc);
  const yLeft = (x, cyc) => Math.sin((TAU * x) / state.lam1 + TAU * cyc);
  function analysis1() {
    return cached("a1", state.lam1, () => analyze((x) => {
      let m = 0;
      for (let j = 0; j < 16; j++) m = Math.max(m, Math.abs(yRight(x, j / 16) + yLeft(x, j / 16)));
      return m;
    }, WINDOW_W, [null, null]));
  }

  // 탭 2 — 줄. 양 끝은 늘 마디
  const vString = () => Math.sqrt(state.T2 / (MU0 * state.thick2 ** 2));
  const fString = (n) => (n * vString()) / (2 * state.L2);

  function stringModel() {
    const key = [state.mode2, state.n2, state.L2, state.T2, state.thick2, state.f2].join("|");
    return cached("string", key, () => {
      const L = state.L2;
      if (state.mode2 === "pick") {
        const n = state.n2;
        return { S: (x) => Math.sin((n * Math.PI * x) / L), level: 1, f: fString(n) };
      }
      const f = state.f2;
      const c = [];
      for (let n = 1; n <= MODES; n++) {
        const r = f / fString(n);
        c.push((r < 1 ? 1 : -1) / Math.hypot(1, Q * (r - 1 / r)));   // 공명에서 1, 멀어지면 빠르게 0
      }
      const raw = (x) => c.reduce((s, a, i) => s + a * Math.sin(((i + 1) * Math.PI * x) / L), 0);
      let peak = 0;
      for (let i = 0; i <= 200; i++) peak = Math.max(peak, Math.abs(raw((i / 200) * L)));
      const k = peak > 1 ? 1 / peak : 1;
      return { S: (x) => raw(x) * k, level: Math.min(1, peak), f };
    });
  }
  function analysis2() {
    const m = stringModel();
    return cached("a2", cache.string.key, () => analyze((x) => Math.abs(m.S(x)), state.L2, ["N", "N"]));
  }

  // 탭 3 — 관 안 공기의 변위. 왼쪽 끝은 늘 열려 있다 (배)
  function tubeModel() {
    const L = state.L3;
    const closed = state.type3 === "closed";
    const n = closed ? 2 * state.idx3 - 1 : state.idx3;
    const lam = closed ? (4 * L) / n : (2 * L) / n;
    const S = closed ? (x) => Math.cos((n * Math.PI * x) / (2 * L)) : (x) => Math.cos((n * Math.PI * x) / L);
    return { S, f: V_SOUND / lam, lam, n, closed };
  }
  function analysis3() {
    const m = tubeModel();
    return cached("a3", [state.type3, state.idx3, state.L3].join("|"), () =>
      analyze((x) => Math.abs(m.S(x)), state.L3, [("A"), m.closed ? "N" : "A"]));
  }

  // 탭 4
  const loudPlate = (x) => {
    const k = (TAU * state.f4p) / vAir();
    return Math.sqrt(1 + R_REFL ** 2 + 2 * R_REFL * Math.cos(2 * k * (PLATE_D - x))) / (1 + R_REFL);
  };
  const respTube = (L) => {
    const lam = vAir() / state.f4t;
    const w = 0.02 * lam;
    let m = 0;
    for (let j = 0; j < 8; j++) m = Math.max(m, 1 / Math.hypot(1, (L - ((2 * j + 1) * lam) / 4) / w));
    return 0.05 + 0.95 * m;
  };
  const level4 = () => (state.ex4 === "plate" ? loudPlate(state.x4) : respTube(TUBE_H - state.h4));
  const f4 = () => (state.ex4 === "plate" ? state.f4p : state.f4t);
  const marks4 = () => (state.ex4 === "plate" ? state.marksP : state.marksT);

  // 표시한 자리들의 간격 — 이웃한 표시 사이의 평균
  function markGaps() {
    const m = [...marks4()].sort((a, b) => a - b);
    const gaps = m.slice(1).map((v, i) => v - m[i]);
    return { gaps, gap: m.length >= 2 ? (m[m.length - 1] - m[0]) / (m.length - 1) : null };
  }

  // 지나온 자리의 소리 크기를 그래프에 남긴다 — 마이크를 옮기며 크기를 읽는 것처럼
  function traceNow() {
    const plate = state.ex4 === "plate";
    const arr = plate ? state.traceP : state.traceT;
    const at = (i) => (plate ? loudPlate(i * BIN) : respTube(TUBE_H - i * BIN));
    const b = Math.round((plate ? state.x4 : state.h4) / BIN);
    const prev = plate ? state.prevP : state.prevT;
    const from = prev == null ? b : prev;
    const step = b >= from ? 1 : -1;
    for (let i = from; i !== b + step; i += step) arr[i] = at(i);
    if (plate) state.prevP = b;
    else state.prevT = b;
  }

  /* ---------------------------------------------------------
     그리기
     --------------------------------------------------------- */
  function label(ctx, text, x, y, color, size = 12, align = "center", weight = "500") {
    ctx.save();
    ctx.font = `${weight} ${size}px Geist, 'Malgun Gothic', sans-serif`;
    ctx.textAlign = align;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.lineWidth = 4;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function seg(ctx, x1, y1, x2, y2, color, width = 1, dash = null, alpha = 1) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function dot(ctx, x, y, r, fill, stroke = "#ffffff") {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    if (stroke) ctx.stroke();
    ctx.restore();
  }

  function ring(ctx, x, y, r, color) {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // pt(t)가 돌려주는 점들을 t = 0..1에서 이어 그린다
  function curve(ctx, color, width, n, pt, dash = null, alpha = 1) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.globalAlpha = alpha;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const [x, y] = pt(i / n);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function paper(ctx, x0, y0, w, h) {
    ctx.save();
    ctx.fillStyle = COLOR_PAPER;
    ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = "#ececec";
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
    ctx.restore();
  }

  function meter(ctx, x, y, w, value, name) {
    label(ctx, name, x, y - 6, COLOR_BODY, 11, "left", "600");
    ctx.save();
    ctx.fillStyle = "#ececec";
    ctx.fillRect(x, y, w, 8);
    ctx.fillStyle = COLOR_INK;
    ctx.fillRect(x, y, w * clamp(value, 0, 1), 8);
    ctx.restore();
    label(ctx, `${(value * 100).toFixed(0)} %`, x + w + 8, y + 8, COLOR_BODY, 12, "left", "600");
  }

  function nodeMarks(ctx, X, an, yNode, yBelly, labelY) {
    if (!an) return;
    an.nodes.forEach((x) => dot(ctx, X(x), yNode, 4.5, COLOR_NODE));
    an.bellies.forEach((x) => ring(ctx, X(x), yBelly(x), 4.5, COLOR_BELLY));
    if (labelY != null) {
      an.nodes.forEach((x) => label(ctx, "마디", X(x), labelY, COLOR_NODE, 11, "center", "600"));
      an.bellies.forEach((x) => label(ctx, "배", X(x), labelY - 14, COLOR_BELLY, 11, "center", "600"));
    }
  }

  /* 탭 1 — 오른쪽으로 가는 파동 + 왼쪽으로 가는 파동 = 정상파 */
  function renderTab1(ctx, g) {
    const x0 = 64;
    const x1 = g.w - 36;
    const bot = g.h - 40;
    const H = bot - TOP;
    const X = (x) => x0 + (x / WINDOW_W) * (x1 - x0);
    const hw = H / 8;
    const s = 0.82 * hw;                  // 진폭 1의 높이 — 합친 줄은 2배 높이
    const c1 = TOP + hw;
    const c2 = TOP + 3 * hw;
    const c3 = TOP + 6 * hw;
    const cyc = state.cyc;
    paper(ctx, x0, TOP, x1 - x0, H);
    [TOP + 2 * hw, TOP + 4 * hw].forEach((y) => seg(ctx, x0, y, x1, y, "#e3e3e3"));
    [c1, c2, c3].forEach((y) => seg(ctx, x0, y, x1, y, "#bdbdbd", 1, [4, 4]));

    const an = analysis1();
    if (state.marks1 && an) {
      an.nodes.forEach((x) => seg(ctx, X(x), TOP, X(x), bot, COLOR_NODE, 1.2, [2, 4], 0.7));
    }
    const wave = (c, fn, color, width) => curve(ctx, color, width, 300, (t) => [X(t * WINDOW_W), c - s * fn(t * WINDOW_W)]);
    wave(c1, (x) => yRight(x, cyc), COLOR_R, 2.2);
    wave(c2, (x) => yLeft(x, cyc), COLOR_L, 2.2);
    curve(ctx, "#bdbdbd", 1.2, 100, (t) => [X(t * WINDOW_W), c3 - 2 * s * Math.abs(Math.sin((TAU * t * WINDOW_W) / state.lam1))], [3, 3]);
    curve(ctx, "#bdbdbd", 1.2, 100, (t) => [X(t * WINDOW_W), c3 + 2 * s * Math.abs(Math.sin((TAU * t * WINDOW_W) / state.lam1))], [3, 3]);
    wave(c3, (x) => yRight(x, cyc) + yLeft(x, cyc), COLOR_INK, 2.6);
    label(ctx, "→ 오른쪽으로 가는 파동", x0 + 8, TOP + 16, COLOR_R, 12, "left", "600");
    label(ctx, "← 왼쪽으로 가는 파동", x0 + 8, c2 - hw + 16, COLOR_L, 12, "left", "600");
    label(ctx, "합친 파동", x0 + 8, c3 - 2 * hw + 16, COLOR_INK, 12, "left", "600");
    if (state.marks1) nodeMarks(ctx, X, an, c3, () => c3 - 2 * s, TOP - 10);

    for (let m = 0; m <= WINDOW_W * 2; m++) {
      const x = X(m / 2);
      seg(ctx, x, bot, x, bot + (m % 2 ? 4 : 7), COLOR_BODY, 1.2);
      if (m % 2 === 0) label(ctx, m === WINDOW_W * 2 ? `${m / 2} m` : `${m / 2}`, x, bot + 21, COLOR_BODY, 11);
    }
    const frac = ((state.cyc % 1) + 1) % 1;
    label(ctx, `t = ${frac.toFixed(2)} T`, x1, TOP - 10, COLOR_BODY, 12, "right", "600");
  }

  /* 탭 2 — 줄 위의 정상파 */
  function renderTab2(ctx, g) {
    const sm = stringModel();
    const an = analysis2();
    const L = state.L2;
    const bot = g.h - 40;
    const ppm = (g.w - 300) / 0.8;
    const len = L * ppm;
    const xa = (g.w - len) / 2 + 24;
    const xb = xa + len;
    const cy = TOP + (bot - TOP) * 0.46;
    const A = 0.3 * (bot - TOP);
    const X = (x) => xa + x * ppm;
    const th = TAU * state.cyc;
    const seek = state.mode2 === "seek";

    // 양 끝 — 왼쪽은 벽, 찾기 모드에서는 진동기
    ctx.save();
    ctx.fillStyle = COLOR_BODY;
    ctx.fillRect(xb, cy - 26, 8, 52);
    if (!seek) ctx.fillRect(xa - 8, cy - 26, 8, 52);
    ctx.restore();
    if (seek) {
      const jig = 2.5 * Math.cos(th) * sm.level;
      ctx.save();
      ctx.fillStyle = COLOR_BODY;
      ctx.beginPath();
      ctx.roundRect(xa - 64, cy - 20 + jig, 44, 40, 5);
      ctx.fill();
      ctx.restore();
      seg(ctx, xa - 20, cy + jig, xa, cy, COLOR_BODY, 3);
      label(ctx, "진동기", xa - 42, cy + 36, COLOR_BODY, 11, "center", "600");
    }

    const env = (x) => Math.abs(sm.S(x));
    curve(ctx, "#bdbdbd", 1.2, 160, (t) => [X(t * L), cy - env(t * L) * A], [3, 3]);
    curve(ctx, "#bdbdbd", 1.2, 160, (t) => [X(t * L), cy + env(t * L) * A], [3, 3]);
    seg(ctx, xa, cy, xb, cy, "#d4d4d4", 1);
    curve(ctx, COLOR_INK, 2.8, 200, (t) => [X(t * L), cy - sm.S(t * L) * Math.cos(th) * A]);
    nodeMarks(ctx, X, an, cy, (x) => cy - env(x) * A, cy + A + 24);
    ctx.save();
    ctx.fillStyle = COLOR_BODY;
    ctx.beginPath();
    ctx.arc(xa, cy, 3.5, 0, TAU);
    ctx.arc(xb, cy, 3.5, 0, TAU);
    ctx.fill();
    ctx.restore();

    const yd = bot - 2;
    seg(ctx, xa, yd, xb, yd, COLOR_BODY, 1.2);
    seg(ctx, xa, yd - 4, xa, yd + 4, COLOR_BODY, 1.2);
    seg(ctx, xb, yd - 4, xb, yd + 4, COLOR_BODY, 1.2);
    label(ctx, `줄의 길이 ${L.toFixed(2)} m`, (xa + xb) / 2, yd - 8, COLOR_BODY, 11, "center", "600");

    if (seek) {
      meter(ctx, g.w - 230, 28, 150, sm.level, "흔들림 크기");
      if (sm.level > 0.85) label(ctx, "공명", g.w - 230, 62, COLOR_BELLY, 13, "left", "600");
    } else {
      label(ctx, `${state.n2}번째 진동`, g.w - 30, 30, COLOR_BODY, 13, "right", "600");
    }
  }

  /* 탭 3 — 관 속 공기의 정상파 */
  function renderTab3(ctx, g) {
    const tm = tubeModel();
    const an = analysis3();
    const L = state.L3;
    const bot = g.h - 40;
    const ppm = (g.w - 260) / 1.0;
    const len = L * ppm;
    const xa = (g.w - len) / 2;
    const xb = xa + len;
    const X = (x) => xa + x * ppm;
    const th = TAU * state.cyc;
    const tubeC = TOP + 44;
    const tubeH = 76;
    const gC = TOP + 178;
    const A = 44;

    // 관과 공기 입자 — 입자가 촘촘한 곳과 성긴 곳이 번갈아 생긴다
    ctx.save();
    ctx.strokeStyle = COLOR_BODY;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(xa, tubeC - tubeH / 2);
    ctx.lineTo(xb, tubeC - tubeH / 2);
    ctx.moveTo(xa, tubeC + tubeH / 2);
    ctx.lineTo(xb, tubeC + tubeH / 2);
    ctx.stroke();
    if (tm.closed) {
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(xb, tubeC - tubeH / 2 - 1);
      ctx.lineTo(xb, tubeC + tubeH / 2 + 1);
      ctx.stroke();
    }
    ctx.restore();
    const kk = TAU / tm.lam;
    const amp = 0.6 / kk;
    const cols = Math.max(20, Math.round(L * 100));
    ctx.save();
    ctx.fillStyle = "rgba(77, 77, 77, 0.78)";
    for (let i = 0; i < cols; i++) {
      const x = ((i + 0.5) / cols) * L;
      const px = X(x + amp * tm.S(x) * Math.cos(th));
      for (let r = 0; r < 5; r++) {
        ctx.beginPath();
        ctx.arc(px, tubeC - tubeH / 2 + 10 + (r * (tubeH - 20)) / 4, 2.1, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    label(ctx, "열린 끝", xa - 8, tubeC + 4, COLOR_MUTE, 11, "right");
    label(ctx, tm.closed ? "닫힌 끝" : "열린 끝", xb + 10, tubeC + 4, COLOR_MUTE, 11, "left");

    // 변위 — 입자가 평형 위치에서 얼마나 움직였나
    const env = (x) => Math.abs(tm.S(x));
    an && an.nodes.forEach((x) => seg(ctx, X(x), tubeC + tubeH / 2, X(x), gC + A + 6, COLOR_NODE, 1.2, [2, 4], 0.55));
    curve(ctx, "#bdbdbd", 1.2, 160, (t) => [X(t * L), gC - env(t * L) * A], [3, 3]);
    curve(ctx, "#bdbdbd", 1.2, 160, (t) => [X(t * L), gC + env(t * L) * A], [3, 3]);
    seg(ctx, xa, gC, xb, gC, "#d4d4d4", 1);
    curve(ctx, COLOR_INK, 2.6, 200, (t) => [X(t * L), gC - tm.S(t * L) * Math.cos(th) * A]);
    nodeMarks(ctx, X, an, gC, (x) => gC - env(x) * A, gC + A + 22);
    label(ctx, "공기 입자의 변위", xa, gC - A - 10, COLOR_BODY, 11, "left", "600");

    const yd = bot - 2;
    seg(ctx, xa, yd, xb, yd, COLOR_BODY, 1.2);
    seg(ctx, xa, yd - 4, xa, yd + 4, COLOR_BODY, 1.2);
    seg(ctx, xb, yd - 4, xb, yd + 4, COLOR_BODY, 1.2);
    label(ctx, `관의 길이 ${L.toFixed(2)} m`, (xa + xb) / 2, yd - 8, COLOR_BODY, 11, "center", "600");
  }

  /* 탭 4 — 반사판 앞에서 마이크를 옮기며 소리 크기 재기 (p.119) */
  function renderPlate(ctx, g) {
    const bot = g.h - 40;
    const x0 = 100;
    const x1 = g.w - 120;
    const ppm = (x1 - x0) / PLATE_D;
    const X = (x) => x0 + x * ppm;
    const yAx = TOP + 52;
    const gy0 = TOP + 138;
    const gy1 = bot - 6;

    // 스피커와 반사판
    ctx.save();
    ctx.fillStyle = COLOR_BODY;
    ctx.beginPath();
    ctx.roundRect(x0 - 40, yAx - 24, 22, 48, 4);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x0 - 18, yAx - 12);
    ctx.lineTo(x0, yAx - 24);
    ctx.lineTo(x0, yAx + 24);
    ctx.lineTo(x0 - 18, yAx + 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#c8c8c8";
    ctx.fillRect(x1, yAx - 34, 9, 68);
    ctx.restore();
    label(ctx, "스피커", x0 - 29, yAx + 42, COLOR_BODY, 11, "center", "600");
    label(ctx, "플라스틱 판", x1 + 4, yAx + 66, COLOR_BODY, 11, "center", "600");
    for (let i = 0; i < 3; i++) {
      const r = 10 + ((i + (state.cyc * 3) % 1) * 12);
      ctx.save();
      ctx.strokeStyle = COLOR_MUTE;
      ctx.globalAlpha = 0.5 * (1 - (r - 10) / 36);
      ctx.beginPath();
      ctx.arc(x0 - 6, yAx, r, -0.7, 0.7);
      ctx.stroke();
      ctx.restore();
    }

    // 자 — 스피커에서 잰 거리
    seg(ctx, x0, yAx, x1, yAx, "#d4d4d4", 1);
    for (let cm = 0; cm <= 30; cm++) {
      const x = X(cm / 100);
      seg(ctx, x, yAx + 26, x, yAx + (cm % 5 ? 30 : 34), COLOR_BODY, 1);
      if (cm % 5 === 0) label(ctx, `${cm}`, x, yAx + 48, COLOR_BODY, 10);
    }
    seg(ctx, x0, yAx + 26, x1, yAx + 26, COLOR_BODY, 1);
    label(ctx, "cm", x1 + 22, yAx + 48, COLOR_BODY, 10, "left");

    // 정상파 보기
    const an = state.show4 ? cached("a4p", [state.f4p, state.temp].join("|"), () => analyze(loudPlate, PLATE_D, [null, null])) : null;
    if (state.show4) {
      curve(ctx, COLOR_BELLY, 1.6, 160, (t) => [X(t * PLATE_D), yAx - 10 - loudPlate(t * PLATE_D) * 28], null, 0.8);
      an && an.nodes.forEach((x) => {
        seg(ctx, X(x), yAx - 38, X(x), yAx + 20, COLOR_NODE, 1.2, [2, 4], 0.7);
        label(ctx, "작음", X(x), yAx - 42, COLOR_NODE, 10, "center", "600");
      });
    }

    // 소리 크기 그래프 — 지나온 자리마다 적힌다
    paper(ctx, x0, gy0, x1 - x0, gy1 - gy0);
    const Y = (v) => gy1 - 8 - v * (gy1 - gy0 - 16);
    seg(ctx, x0, Y(0), x1, Y(0), "#d4d4d4", 1);
    label(ctx, "소리 크기", x0, gy0 - 6, COLOR_BODY, 11, "left", "600");
    ctx.save();
    ctx.fillStyle = COLOR_INK;
    state.traceP.forEach((v, i) => {
      if (v == null) return;
      ctx.beginPath();
      ctx.arc(X(i * BIN), Y(v), 1.8, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
    state.marksP.forEach((x) => {
      seg(ctx, X(x), yAx - 4, X(x), gy1, COLOR_MARK, 1.4, [4, 3]);
      label(ctx, `${(x * 100).toFixed(1)}`, X(x), gy1 - 2 - 0, COLOR_MARK, 10, "center", "600");
    });

    // 마이크
    const mx = X(state.x4);
    seg(ctx, mx, yAx - 30, mx, yAx - 2, COLOR_INK, 2);
    ctx.save();
    ctx.fillStyle = COLOR_INK;
    ctx.beginPath();
    ctx.roundRect(mx - 6, yAx - 12, 12, 24, 6);
    ctx.fill();
    ctx.restore();
    label(ctx, "마이크", mx, yAx - 36, COLOR_INK, 11, "center", "600");
    dot(ctx, mx, Y(loudPlate(state.x4)), 4.5, COLOR_INK);
    meter(ctx, g.w - 230, 28, 130, loudPlate(state.x4), "소리 크기");
    hit = { kind: "plate", x0, ppm, y0: yAx - 40, y1: gy1 };
  }

  /* 탭 4 — 눈금실린더의 물 높이를 바꿔 공명 찾기 (p.122) */
  function renderTube(ctx, g) {
    const bot = g.h - 40;
    const yTop = TOP + 34;
    const ppm = (bot - yTop - 4) / TUBE_H;
    const yBot = yTop + TUBE_H * ppm;
    const cx = Math.round(g.w * 0.2);
    const half = 28;
    const Y = (h) => yBot - h * ppm;
    const L = TUBE_H - state.h4;
    const resp = respTube(L);
    const th = TAU * state.cyc;
    const lam = vAir() / state.f4t;

    // 물과 유리관
    ctx.save();
    ctx.fillStyle = COLOR_WATER;
    ctx.fillRect(cx - half, Y(state.h4), 2 * half, state.h4 * ppm);
    ctx.strokeStyle = COLOR_BODY;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - half, yTop);
    ctx.lineTo(cx - half, yBot);
    ctx.lineTo(cx + half, yBot);
    ctx.lineTo(cx + half, yTop);
    ctx.stroke();
    ctx.restore();
    seg(ctx, cx - half, Y(state.h4), cx + half, Y(state.h4), "#6aa9e0", 2);
    for (let cm = 0; cm <= 80; cm += 10) {
      seg(ctx, cx - half - 8, Y(cm / 100), cx - half, Y(cm / 100), COLOR_BODY, 1);
      label(ctx, `${cm}`, cx - half - 12, Y(cm / 100) + 4, COLOR_BODY, 10, "right");
    }
    label(ctx, "cm", cx - half - 12, yTop - 12, COLOR_BODY, 10, "right");

    // 공기 기둥 속 정상파 — 입구가 배, 물 표면이 마디
    const S = (u) => Math.cos((TAU * u) / lam);
    const aw = (half - 6) * resp;
    const uTop = yTop;
    curve(ctx, COLOR_BELLY, 1.2, 100, (t) => [cx - Math.abs(S(t * L)) * aw, uTop + t * L * ppm], [3, 3], 0.7);
    curve(ctx, COLOR_BELLY, 1.2, 100, (t) => [cx + Math.abs(S(t * L)) * aw, uTop + t * L * ppm], [3, 3], 0.7);
    curve(ctx, COLOR_INK, 2.2, 120, (t) => [cx + S(t * L) * Math.cos(th) * aw, uTop + t * L * ppm]);

    // 소리굽쇠
    const shake = 2.2 * Math.cos(th) * resp;
    ctx.save();
    ctx.strokeStyle = COLOR_BODY;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - 9 + shake, yTop - 34);
    ctx.lineTo(cx - 9, yTop - 12);
    ctx.lineTo(cx + 9, yTop - 12);
    ctx.lineTo(cx + 9 - shake, yTop - 34);
    ctx.moveTo(cx, yTop - 12);
    ctx.lineTo(cx, yTop - 4);
    ctx.stroke();
    ctx.restore();
    label(ctx, `소리굽쇠 ${state.f4t} Hz`, cx + 42, yTop - 18, COLOR_BODY, 11, "left", "600");

    // 그래프 — 물 높이마다 얼마나 크게 들리나. 높이는 유리관과 나란히
    const gx0 = cx + 120;
    const gx1 = g.w - 130;
    paper(ctx, gx0, yTop, gx1 - gx0, yBot - yTop);
    const Xg = (v) => gx0 + 10 + v * (gx1 - gx0 - 20);
    label(ctx, "소리 크기 →", gx0 + 8, yTop + 16, COLOR_BODY, 11, "left", "600");
    ctx.save();
    ctx.fillStyle = COLOR_INK;
    state.traceT.forEach((v, i) => {
      if (v == null) return;
      ctx.beginPath();
      ctx.arc(Xg(v), Y(i * BIN), 1.8, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
    state.marksT.forEach((h) => {
      seg(ctx, cx - half, Y(h), gx1, Y(h), COLOR_MARK, 1.4, [4, 3]);
      label(ctx, `${(h * 100).toFixed(1)}`, gx1 + 6, Y(h) + 4, COLOR_MARK, 10, "left", "600");
    });
    seg(ctx, gx0, Y(state.h4), gx1, Y(state.h4), COLOR_BODY, 1, [2, 4], 0.5);
    dot(ctx, Xg(resp), Y(state.h4), 4.5, COLOR_INK);

    if (state.show4) {
      for (let j = 0; j < 8; j++) {
        const Lm = ((2 * j + 1) * lam) / 4;
        if (Lm > TUBE_H) break;
        label(ctx, j ? `${2 * j + 1}λ/4` : "λ/4", cx + half + 8, Y(TUBE_H - Lm) + 4, COLOR_NODE, 10, "left", "600");
      }
    }
    meter(ctx, g.w - 230, 28, 130, resp, "소리 크기");
    hit = { kind: "tube", cx, half, yBot, ppm, gx1 };
  }

  function render() {
    const { w, h, ctx } = SimUtils.fitCanvas(canvas);
    ctx.fillStyle = COLOR_STAGE;
    ctx.fillRect(0, 0, w, h);
    hit = null;
    const g = { w, h };
    if (state.tab === 1) renderTab1(ctx, g);
    else if (state.tab === 2) renderTab2(ctx, g);
    else if (state.tab === 3) renderTab3(ctx, g);
    else if (state.ex4 === "plate") renderPlate(ctx, g);
    else renderTube(ctx, g);
  }

  /* ---------------------------------------------------------
     카드 — 측정한 값과 비교용 공식값
     --------------------------------------------------------- */
  const fix = (v, d) => (v == null ? null : v.toFixed(d));
  const dash = (v, unit, d = 2) => (v == null ? "–" : `${v.toFixed(d)} ${unit}`);

  function cardsTab1() {
    const an = analysis1();
    const cross = upCross((x) => yRight(x, state.cyc), WINDOW_W);
    const lam = cross.length >= 2 ? (cross[cross.length - 1] - cross[0]) / (cross.length - 1) : null;
    return [
      {
        name: "서로 반대로 가는 두 파동", tag: null,
        sym: "λ", val: fix(lam, 2), unit: "m",
        rows: [
          { k: "각 파동의 진폭", v: "A" },
          { k: "합친 파동의 진폭", v: "0 ~ 2A" },
        ],
        f1: "파란 파동은 →, 주황 파동은 ←. 둘을 더하면 정상파",
      },
      {
        name: "정상파", tag: null,
        sym: "마디 간격", val: an ? fix(an.gap, 2) : null, unit: "m",
        rows: [
          { k: "λ/2 (비교)", v: lam == null ? "–" : `${(lam / 2).toFixed(2)} m` },
          { k: "마디 · 배", v: an ? `${an.nodes.length} · ${an.bellies.length}` : "–" },
        ],
        f1: "마디는 늘 그 자리에 있고, 배는 가장 크게 흔들린다",
      },
    ];
  }

  function cardsTab2() {
    const sm = stringModel();
    const an = analysis2();
    const v = vString();
    const recs = Object.keys(state.rec2).map(Number).sort((a, b) => a - b);
    const fs = recs.map((n) => state.rec2[n]);
    const lo = fs.length ? Math.min(...fs) : null;
    const ratio = fs.length ? fs.map((f) => String(Math.round((f / lo) * 10) / 10)).join(" : ") : "–";
    const seek = state.mode2 === "seek";
    const lam = an ? an.lam : null;
    return [
      {
        name: "줄 위의 정상파", tag: seek && sm.level < PEAK_MIN ? { text: "흔들림이 작음" } : null,
        sym: "λ", val: fix(lam, 3), unit: "m",
        rows: [
          { k: "마디 간격", v: dash(an && an.gap, "m", 3) },
          { k: "배의 수", v: an ? `${an.bellies.length}개` : "–" },
        ],
        f1: seek ? `진동수를 돌려 크게 흔들리는 곳을 찾고 [기록]` : "줄의 양 끝은 고정이라 늘 마디다",
      },
      {
        name: "소리의 진동수", spk: true, tag: null,
        sym: "f", val: Math.round(sm.f), unit: "Hz",
        rows: [
          { k: "잰 속력 fλ", v: lam == null ? "–" : `${(sm.f * lam).toFixed(0)} m/s` },
          { k: seek ? "기록한 진동수의 비" : "줄의 속력", v: seek ? ratio : `${v.toFixed(0)} m/s` },
        ],
        f1: seek
          ? (recs.length ? `기록 · ${recs.map((n) => `${Math.round(state.rec2[n])} Hz`).join(" · ")}` : "찾은 진동수를 [기록]으로 남긴다")
          : `비교 · n·v/2L = ${fString(state.n2).toFixed(0)} Hz (줄의 속력 ${v.toFixed(0)} m/s)`,
      },
    ];
  }

  function cardsTab3() {
    const tm = tubeModel();
    const an = analysis3();
    const lam = an ? an.lam : null;
    return [
      {
        name: "공기 기둥의 정상파", tag: { text: tm.closed ? "한쪽 닫힘" : "양쪽 열림" },
        sym: "λ", val: fix(lam, 3), unit: "m",
        rows: [
          { k: "마디 간격", v: dash(an && an.gap, "m", 3) },
          { k: "마디 · 배", v: an ? `${an.nodes.length} · ${an.bellies.length}` : "–" },
        ],
        f1: "열린 끝은 배, 닫힌 끝은 마디다",
      },
      {
        name: "소리의 진동수", spk: true, tag: null,
        sym: "f", val: Math.round(tm.f), unit: "Hz",
        rows: [
          { k: "잰 속력 fλ", v: lam == null ? "–" : `${(tm.f * lam).toFixed(0)} m/s` },
          { k: "음속", v: `${V_SOUND} m/s` },
        ],
        f1: tm.closed
          ? `비교 · n·v/4L = ${tm.f.toFixed(0)} Hz (n = ${tm.n})`
          : `비교 · n·v/2L = ${tm.f.toFixed(0)} Hz (n = ${tm.n})`,
      },
    ];
  }

  function cardsTab4() {
    const plate = state.ex4 === "plate";
    const { gaps, gap } = markGaps();
    const f = f4();
    const marks = marks4();
    const lam = gap == null ? null : 2 * gap;
    return [
      {
        name: plate ? "소리가 작은 자리" : "소리가 커지는 자리", tag: null,
        sym: "λ/2", val: gap == null ? null : (gap * 100).toFixed(1), unit: "cm",
        rows: [
          { k: "표시한 곳", v: `${marks.length}개` },
          { k: "파장 λ", v: lam == null ? "–" : `${(lam * 100).toFixed(1)} cm` },
        ],
        f1: gaps.length ? `간격 · ${gaps.map((d) => (d * 100).toFixed(1)).join(" · ")} cm` : (plate ? "소리가 작은 곳마다 [표시]를 누른다" : "소리가 커지는 곳마다 [표시]를 누른다"),
      },
      {
        name: "음속 측정", spk: true, tag: null,
        sym: "v", val: lam == null ? null : (f * lam).toFixed(0), unit: "m/s",
        rows: [
          { k: "진동수 f", v: `${f} Hz` },
          { k: "기온 기준 음속", v: `${vAir().toFixed(0)} m/s` },
        ],
        f1: `v = fλ · 기온 ${state.temp} °C → 331 + 0.6t`,
      },
    ];
  }

  function applyCard(el, m) {
    el.name.textContent = m.name;
    el.tag.textContent = m.tag ? m.tag.text : "";
    el.tag.className = "obs-tag " + (m.tag && m.tag.cls ? m.tag.cls : "");
    el.fbox.className = "obs-f" + (m.val == null ? " is-empty" : "");
    el.sym.textContent = m.sym || "";
    el.val.textContent = m.val == null ? "–" : m.val;
    el.unit.textContent = m.unit || "";
    m.rows.forEach((r, i) => {
      el.k[i].textContent = r.k;
      el.v[i].textContent = r.v;
    });
    if (el.spk) el.spk.classList.toggle("hidden", !m.spk);
    el.f1.textContent = m.f1 || "";
  }

  /* ---------------------------------------------------------
     소리 — 지금 보이는 정상파의 실제 진동수
     --------------------------------------------------------- */
  const audio = { ctx: null, osc: null, gain: null, last: {} };

  function startAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      toast("이 브라우저에서는 소리를 낼 수 없다");
      return false;
    }
    const ac = new AC();
    audio.ctx = ac;
    audio.osc = ac.createOscillator();
    audio.gain = ac.createGain();
    audio.gain.gain.value = 0;
    audio.osc.connect(audio.gain);
    audio.gain.connect(ac.destination);
    audio.osc.start();
    return true;
  }

  // 값이 바뀔 때만 예약한다 — 매 프레임 예약하면 자동화 목록이 쌓인다
  function setLevel(name, param, value, tc) {
    if (Math.abs((audio.last[name] ?? -1) - value) < 1e-4) return;
    audio.last[name] = value;
    param.setTargetAtTime(value, audio.ctx.currentTime, tc);
  }

  function soundSpec() {
    if (state.tab === 2) {
      const sm = stringModel();
      return { f: sm.f, level: sm.level >= 0.15 ? sm.level : 0 };
    }
    if (state.tab === 3) return { f: tubeModel().f, level: 1 };
    if (state.tab === 4) return { f: f4(), level: level4() };
    return null;
  }

  function updateSound() {
    if (!audio.ctx) return;
    const spec = soundSpec();
    const on = state.sound && !state.paused && !document.hidden && spec;
    if (on) setLevel("f", audio.osc.frequency, clamp(spec.f, 20, 8000), 0.02);
    setLevel("g", audio.gain.gain, on ? VOL * spec.level : 0, 0.04);
  }

  function toggleSound() {
    if (!audio.ctx && !startAudio()) return;
    if (audio.ctx.state === "suspended") audio.ctx.resume();
    state.sound = !state.sound;
    cardEls.filter((el) => el.spk).forEach((el) => {
      el.spk.classList.toggle("is-on", state.sound);
      el.spk.setAttribute("aria-pressed", String(state.sound));
    });
    if (state.sound) toast("볼륨을 낮추고 들어 보세요");
    updateSound();
  }

  /* ---------------------------------------------------------
     조작
     --------------------------------------------------------- */
  let toastTimer = 0;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2600);
  }

  // 슬라이더·숫자 입력 — k는 화면에 보이는 값 = 상태값 × k (cm)
  const P = {
    lam1: { get: () => state.lam1, put: (v) => { state.lam1 = v; }, min: 0.8, max: 2, step: 0.1, d: 1, k: 1 },
    f2: { get: () => state.f2, put: (v) => { state.f2 = v; }, min: 50, max: 1500, step: 1, d: 0, k: 1 },
    L2: { get: () => state.L2, put: (v) => { state.L2 = v; }, min: 0.3, max: 0.8, step: 0.05, d: 2, k: 1, after: clearRec },
    T2: { get: () => state.T2, put: (v) => { state.T2 = v; }, min: 20, max: 120, step: 10, d: 0, k: 1, after: clearRec },
    L3: { get: () => state.L3, put: (v) => { state.L3 = v; }, min: 0.2, max: 1, step: 0.05, d: 2, k: 1 },
    f4p: { get: () => state.f4p, put: (v) => { state.f4p = v; }, min: 1000, max: 4000, step: 50, d: 0, k: 1, after: clearPlate },
    temp: { get: () => state.temp, put: (v) => { state.temp = v; }, min: 0, max: 30, step: 1, d: 0, k: 1, after: () => { clearPlate(); clearTube(); } },
    x4: { get: () => state.x4, put: (v) => { state.x4 = v; }, min: 0, max: 30, step: 0.1, d: 1, k: 100, after: traceNow },
    h4: { get: () => state.h4, put: (v) => { state.h4 = v; }, min: 0, max: 75, step: 0.1, d: 1, k: 100, after: traceNow },
  };

  function clearRec() {
    state.rec2 = {};
  }

  function clearPlate() {
    state.marksP = [];
    state.traceP = [];
    state.prevP = null;
    traceAt("plate");
  }

  function clearTube() {
    state.marksT = [];
    state.traceT = [];
    state.prevT = null;
    traceAt("tube");
  }

  function traceAt(ex) {
    const keep = state.ex4;
    state.ex4 = ex;
    traceNow();
    state.ex4 = keep;
  }

  function setParam(key, raw) {
    const p = P[key];
    let v = Number(raw);
    if (!Number.isFinite(v) || raw === "") v = p.get() * p.k;
    v = clamp(Math.round(v / p.step) * p.step, p.min, p.max);
    v = Number(v.toFixed(4));
    const old = p.get();
    p.put(v / p.k);
    if (p.get() !== old && p.after) p.after();
    syncUI();
  }

  function syncUI() {
    Object.entries(P).forEach(([key, p]) => {
      const input = $(key + "Input");
      input.min = p.min;
      input.max = p.max;
      input.step = p.step;
      input.value = p.get() * p.k;
      const num = $(key + "Num");
      num.min = p.min;
      num.max = p.max;
      num.step = p.step;
      if (document.activeElement !== num) num.value = (p.get() * p.k).toFixed(p.d);
    });
    const on = (sel, test) => document.querySelectorAll(sel).forEach((b) => b.classList.toggle("is-active", test(b)));
    on("#mode2Seg button", (b) => b.dataset.mode === state.mode2);
    on("#n2Seg button", (b) => Number(b.dataset.n) === state.n2);
    on("#thickSeg button", (b) => Number(b.dataset.thick) === state.thick2);
    on("#type3Seg button", (b) => b.dataset.type === state.type3);
    on("#idx3Seg button", (b) => Number(b.dataset.idx) === state.idx3);
    on("#ex4Seg button", (b) => b.dataset.ex === state.ex4);
    on("#forkSeg button", (b) => Number(b.dataset.f) === state.f4t);
    const seek = state.mode2 === "seek";
    $("n2Seg").classList.toggle("hidden", seek);
    $("recBtn").classList.toggle("hidden", !seek);
    $("f2Row").classList.toggle("hidden", !seek);
    const labels = state.type3 === "closed" ? ["기본", "3배", "5배", "7배"] : ["기본", "2배", "3배", "4배"];
    document.querySelectorAll("#idx3Seg button").forEach((b, i) => { b.textContent = labels[i]; });
    document.querySelectorAll("[data-ex-only]").forEach((el) => el.classList.toggle("hidden", el.dataset.exOnly !== state.ex4));
    $("marksBtn").classList.toggle("is-on", state.marks1);
    $("marksBtn").setAttribute("aria-pressed", String(state.marks1));
    $("show4Btn").classList.toggle("is-on", state.show4);
    $("show4Btn").setAttribute("aria-pressed", String(state.show4));
  }

  function setTab(n) {
    if (n === state.tab) return;
    state.tab = n;
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("is-active", Number(b.dataset.tab) === n));
    document.querySelectorAll(".ctrl-pane").forEach((p) => p.classList.toggle("hidden", Number(p.dataset.pane) !== n));
    syncUI();
    updateStatus();
    lastCards = 0;
  }

  function quarter() {
    state.paused = true;
    state.cyc = Math.round(state.cyc * 4) / 4 + 0.25;
    $("pauseBtn").textContent = "계속";
    updateStatus();
  }

  function togglePause() {
    state.paused = !state.paused;
    $("pauseBtn").textContent = state.paused ? "계속" : "일시정지";
    updateStatus();
  }

  function reset() {
    state.cyc = 0;
    if (state.tab === 2) clearRec();
    if (state.tab === 4) (state.ex4 === "plate" ? clearPlate : clearTube)();
    if (state.paused) togglePause();
    updateStatus();
  }

  function recordString() {
    const sm = stringModel();
    const an = analysis2();
    if (!an || sm.level < 0.85) {
      toast("크게 흔들릴 때 기록한다");
      return;
    }
    state.rec2[an.bellies.length] = state.f2;
    toast(`${an.bellies.length}번째 진동 · ${state.f2} Hz 기록`);
  }

  function markNow() {
    const arr = marks4();
    const v = state.ex4 === "plate" ? state.x4 : state.h4;
    if (arr.some((m) => Math.abs(m - v) < 0.002)) return;
    if (arr.length >= 8) {
      toast("표시는 8개까지다");
      return;
    }
    arr.push(v);
    arr.sort((a, b) => a - b);
  }

  function updateStatus() {
    let tag;
    if (state.tab === 1) tag = `파장 λ ${state.lam1.toFixed(1)} m`;
    else if (state.tab === 2) tag = `줄 ${state.L2.toFixed(2)} m · 장력 ${state.T2} N · 굵기 ${state.thick2}배`;
    else if (state.tab === 3) tag = `${state.type3 === "closed" ? "한쪽 닫힌 관" : "양쪽 열린 관"} ${state.L3.toFixed(2)} m`;
    else tag = state.ex4 === "plate" ? `반사판 ${PLATE_D * 100} cm · ${state.f4p} Hz · ${state.temp} °C` : `눈금실린더 ${TUBE_H * 100} cm · ${state.f4t} Hz · ${state.temp} °C`;
    if (state.paused) tag += " · 일시정지";
    $("statusTag").textContent = tag;
    const hint = state.tab === 1 ? "일시정지하고 [T/4 넘기기]로 한 장면씩 본다"
      : state.tab === 2 ? (state.mode2 === "seek" ? "진동수를 돌려 크게 흔들리는 곳을 찾는다" : "줄의 양 끝은 늘 마디다")
        : state.tab === 3 ? "열린 끝은 배, 닫힌 끝은 마디다"
          : state.ex4 === "plate" ? "마이크를 끌어 소리가 작은 곳마다 [표시]를 누른다" : "물 높이를 바꿔 소리가 커지는 곳마다 [표시]를 누른다";
    $("stageHint").textContent = hint;
  }

  /* 끌기 — 탭 4에서 마이크나 물 높이를 직접 옮긴다 */
  function bindDrag() {
    let dragging = false;
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const inside = (pt) => {
      if (!hit) return false;
      if (hit.kind === "plate") return pt.x >= hit.x0 - 12 && pt.x <= hit.x0 + PLATE_D * hit.ppm + 12 && pt.y >= hit.y0 && pt.y <= hit.y1;
      return pt.x >= hit.cx - hit.half - 30 && pt.x <= hit.gx1 && pt.y >= hit.yBot - TUBE_H * hit.ppm - 10 && pt.y <= hit.yBot + 10;
    };
    const move = (pt) => {
      if (hit.kind === "plate") setParam("x4", ((pt.x - hit.x0) / hit.ppm) * 100);
      else setParam("h4", ((hit.yBot - pt.y) / hit.ppm) * 100);
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (state.tab !== 4 || !inside(pos(e))) return;
      e.preventDefault();
      dragging = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 포인터가 이미 사라졌으면 잡지 않고 진행 */ }
      move(pos(e));
    });
    canvas.addEventListener("pointermove", (e) => {
      if (dragging) {
        move(pos(e));
        return;
      }
      canvas.style.cursor = state.tab === 4 && inside(pos(e)) ? (hit.kind === "plate" ? "ew-resize" : "ns-resize") : "default";
    });
    const end = () => { dragging = false; };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
  }

  /* ---------------------------------------------------------
     재생
     --------------------------------------------------------- */
  let lastTs = null;
  let lastCards = 0;

  function frame(ts) {
    const dt = lastTs == null ? 0 : Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    if (!state.paused && dt > 0) state.cyc = (state.cyc + dt / state.period) % 1000;
    render();
    if (ts - lastCards > 100) {
      models = state.tab === 1 ? cardsTab1() : state.tab === 2 ? cardsTab2() : state.tab === 3 ? cardsTab3() : cardsTab4();
      cardEls.forEach((el, i) => applyCard(el, models[i]));
      lastCards = ts;
    }
    updateSound();
    requestAnimationFrame(frame);
  }

  function bind() {
    $("pauseBtn").addEventListener("click", togglePause);
    $("resetBtn").addEventListener("click", reset);
    $("quarterBtn").addEventListener("click", quarter);
    $("marksBtn").addEventListener("click", () => { state.marks1 = !state.marks1; syncUI(); });
    $("show4Btn").addEventListener("click", () => { state.show4 = !state.show4; syncUI(); });
    $("recBtn").addEventListener("click", recordString);
    $("markBtn").addEventListener("click", markNow);
    $("clearBtn").addEventListener("click", () => (state.ex4 === "plate" ? clearPlate : clearTube)());
    document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => setTab(Number(b.dataset.tab))));
    document.querySelectorAll("#mode2Seg button").forEach((b) => b.addEventListener("click", () => {
      state.mode2 = b.dataset.mode;
      syncUI();
      updateStatus();
    }));
    document.querySelectorAll("#n2Seg button").forEach((b) => b.addEventListener("click", () => { state.n2 = Number(b.dataset.n); syncUI(); }));
    document.querySelectorAll("#thickSeg button").forEach((b) => b.addEventListener("click", () => {
      state.thick2 = Number(b.dataset.thick);
      clearRec();
      syncUI();
      updateStatus();
    }));
    document.querySelectorAll("#type3Seg button").forEach((b) => b.addEventListener("click", () => {
      state.type3 = b.dataset.type;
      syncUI();
      updateStatus();
    }));
    document.querySelectorAll("#idx3Seg button").forEach((b) => b.addEventListener("click", () => { state.idx3 = Number(b.dataset.idx); syncUI(); }));
    document.querySelectorAll("#ex4Seg button").forEach((b) => b.addEventListener("click", () => {
      state.ex4 = b.dataset.ex;
      syncUI();
      updateStatus();
      lastCards = 0;
    }));
    document.querySelectorAll("#forkSeg button").forEach((b) => b.addEventListener("click", () => {
      state.f4t = Number(b.dataset.f);
      clearTube();
      syncUI();
      updateStatus();
    }));
    Object.keys(P).forEach((key) => {
      $(key + "Input").addEventListener("input", (e) => setParam(key, e.target.value));
      $(key + "Num").addEventListener("change", (e) => setParam(key, e.target.value));
    });
    document.querySelectorAll(".num").forEach((el) =>
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); }));
    cardEls.filter((el) => el.spk).forEach((el) => el.spk.addEventListener("click", toggleSound));
    $("periodSelect").addEventListener("change", (e) => { state.period = Number(e.target.value); });
    $("settingsToggle").addEventListener("click", () => $("settingsOverlay").classList.remove("hidden"));
    $("settingsClose").addEventListener("click", () => $("settingsOverlay").classList.add("hidden"));
    $("settingsBackdrop").addEventListener("click", () => $("settingsOverlay").classList.add("hidden"));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") $("settingsOverlay").classList.add("hidden");
    });
    document.addEventListener("visibilitychange", updateSound);
    bindDrag();
  }

  function init() {
    canvas = $("simCanvas");
    cardEls = [...document.querySelectorAll(".obs-card")].map((card) => {
      const q = (role) => card.querySelector(`[data-role="${role}"]`);
      return {
        name: q("name"), tag: q("tag"), spk: q("spk"), fbox: q("fbox"), sym: q("sym"), val: q("val"), unit: q("unit"),
        k: [q("k1"), q("k2")], v: [q("v1"), q("v2")], f1: q("f1"),
      };
    });
    bind();
    traceAt("plate");
    traceAt("tube");
    syncUI();
    updateStatus();
    requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
