/* ============================================================
   소리의 간섭
   교과서: (동아출판) 역학과 에너지 pp.112~117 「04 소리의 간섭」
   성취기준: [12역학03-04]

   1 간섭무늬     두 스피커의 마루·골이 만나 보강·상쇄 지점이 생긴다   (p.113 그림 III-22, p.114 그림 III-23)
   2 걸으며 듣기  스피커 앞을 걸으면 소리가 커졌다 작아졌다 한다      (p.113 그림 III-21, p.116 문제 4)
   3 소음 제거    반대 위상의 소리로 소음을 지운다                    (p.114 그림 III-24)

   ※ 음속 340 m/s. 화면은 한 번 진동하는 데 1.5초 걸리게 느리게 돌리고, 소리는 실제 진동수로 낸다.
   ※ 스피커에서 r만큼 떨어진 곳의 진폭은 1/r (1 m에서 1). 그래서 상쇄 지점도 완전히 0은 아니다.
   ※ 진폭·보강/상쇄·간격·위상 차는 공식으로 띄우지 않는다. 그 자리의 소리를 한 주기 동안 받아 적어서 잰다.
   ============================================================ */

(() => {
  "use strict";

  /* ---------------------------------------------------------
     캔버스에 직접 그리는 색.
     CSS의 변수와는 별개의 하드코딩 상수다.
     색을 바꿀 때는 sound-interference.css와 여기를 함께 고쳐야 한다.
     --------------------------------------------------------- */
  const COLOR_STAGE = "#ffffff";
  const COLOR_INK   = "#171717";
  const COLOR_BODY  = "#4d4d4d";
  const COLOR_MUTE  = "#8f8f8f";
  const COLOR_LINE  = "#d4d4d4";
  const COLOR_A     = "#0070f3";   // 스피커 A — 교과서 그림 III-22의 파랑
  const COLOR_B     = "#e5620a";   // 스피커 B — 주황
  const COLOR_NOISE = "#9e9e9e";   // 외부 소음
  const COLOR_ANTI  = "#7928ca";   // 이어폰이 낸 반대 위상의 소리
  const MAP_INK = [72, 72, 72];    // 세기 지도 — 크게 들리는 곳일수록 이 색에 가깝게 (잉크보다 옅게, 무대가 무거워 보이지 않게)

  const V = 340;                   // 음속 (m/s)
  const F_MIN = 170;
  const F_MAX = 680;               // 파장 2 m ~ 0.5 m
  const D_MIN = 1;
  const D_MAX = 4;
  const R_NEAR = 0.3;              // 스피커 바로 앞은 진폭이 끝없이 커지지 않게 이 거리로 친다
  const VIEW_TOP = -1.0;           // 무대에 보이는 세로 범위 (m) — 스피커 줄이 0, 아래로 +
  const VIEW_BOTTOM = 6.0;
  const VIEW_HALF_W = 7.6;         // 가로로 적어도 이만큼은 보인다 (걷는 길 ±7 m)
  const EAR_START = { x: 0, y: 3.5 };
  const LINES = { near: 2, far: 5 };   // 탭 2 — 스피커 줄에서 걷는 줄까지 (m)
  const WALK_X = 7;
  const WALK_SPEED = 1.2;          // 걷는 빠르기 (m/s). 소리가 한결같아서 실제 빠르기로 걷는다
  const CURVE_M = 1.3;             // 탭 2 — 진폭 1을 줄 위로 이만큼(m) 높이 그린다
  const AMP_MAP = 0.9;             // 세기 지도 — 이 진폭 이상은 가장 진하게
  const STRIP_PERIODS = 3;         // 카드 그래프에 담는 주기 수

  // 탭 3 엔진 소음 — 홀수 배음만 섞는다. 반 주기 늦추면 정확히 뒤집혀서 위상 차 180°에서 완전히 사라진다
  const NOISE_F = 110;
  const NOISE_H = [[1, 1, 0], [3, 0.42, 0.7], [5, 0.22, 2.1], [7, 0.12, 0.9]];   // [배음, 진폭, 위상]

  const VOL_TONE = 0.09;
  const VOL_NOISE = 0.06;
  const VOL_MUSIC = 0.05;
  const AMP_LOUD = 0.9;            // 탭 1·2 — 이 진폭이면 가장 크게 (가까운 줄 한가운데쯤)
  // 작은 별 — [음 (도 = 0), 박]. null은 쉼
  const MELODY = [[0, 1], [0, 1], [4, 1], [4, 1], [5, 1], [5, 1], [4, 2], [3, 1], [3, 1], [2, 1], [2, 1], [1, 1], [1, 1], [0, 2], [null, 2]];
  const SCALE = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0];
  const BEAT = 0.42;               // 한 박 (s)

  const $ = (id) => document.getElementById(id);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const TAU = 2 * Math.PI;

  const state = {
    tab: 1,
    paused: false,
    period: 1.5,         // 화면에서 한 번 진동하는 데 걸리는 시간 (s)
    cyc: 0,              // 화면에서 지나간 진동 수 — 위상 = 2π × cyc
    f: 340,
    d: 2,
    flipB: false,        // 탭 1 — B를 반대 위상으로
    view: "waves",       // waves 마루·골 · map 세기 지도
    ear: { ...EAR_START },
    count: 2,            // 탭 2 스피커 수
    line: "far",
    walk: { on: false, x: -WALK_X },
    curves: {},          // "2far" → [{ x, amp }] — 걸으며 잰 진폭
    anc: false,          // 탭 3 소음 제거
    theta: 180,          // 이어폰 소리의 위상 차 (°)
    music: true,
    sound: false,
  };

  let canvas = null;
  let lastG = null;
  let cardEls = [];
  let models = null;
  let heard = 0;         // 탭 1·2 — 지금 듣는 자리의 진폭 (소리 크기)
  let noisePeak = 1;

  /* ---------------------------------------------------------
     소리 — 스피커마다 1/r로 줄어드는 사인파. 겹치면 그냥 더한다
     --------------------------------------------------------- */
  const lambda = () => V / state.f;

  // 스피커 위치와 위상. 탭 2는 늘 같은 위상이고, 1개면 가운데에 하나
  function speakers() {
    if (state.tab === 2 && state.count === 1) return [{ x: 0, ph: 0, color: COLOR_INK, name: "" }];
    return [
      { x: -state.d / 2, ph: 0, color: COLOR_A, name: "A" },
      { x: state.d / 2, ph: state.tab === 1 && state.flipB ? Math.PI : 0, color: COLOR_B, name: "B" },
    ];
  }

  // 스피커 s의 소리가 (x, y)에서 c번째 진동 때 만드는 변위 — 진폭 1/r, r/λ 주기만큼 늦다
  function wave(s, x, y, c, lam) {
    const r = Math.max(R_NEAR, Math.hypot(x - s.x, y));
    return Math.sin(TAU * (c - r / lam) + s.ph) / r;
  }

  // 그 자리의 소리를 마지막 한 주기 동안 받아 적는다 — 스피커마다의 진폭과 합친 진폭
  function listen(x, y) {
    const sp = speakers();
    const lam = lambda();
    const n = 48;
    const sq = new Float64Array(sp.length + 1);
    for (let k = 0; k < n; k++) {
      const c = state.cyc - k / n;
      let tot = 0;
      for (let i = 0; i < sp.length; i++) {
        const v = wave(sp[i], x, y, c, lam);
        sq[i] += v * v;
        tot += v;
      }
      sq[sp.length] += tot * tot;
    }
    const amp = (s2) => Math.sqrt((2 * s2) / n);
    return { each: sp.map((_, i) => amp(sq[i])), sum: amp(sq[sp.length]) };
  }

  // 보강·상쇄 — 합친 진폭이 두 진폭의 합에 가까우면 보강, 차에 가까우면 상쇄
  function judge(a, b, s) {
    const hi = a + b;
    const lo = Math.abs(a - b);
    if (hi - lo < 1e-9) return "";
    const q = (s - lo) / (hi - lo);
    return q > 0.9 ? "보강" : q < 0.1 ? "상쇄" : "";
  }

  /* 탭 2 — 걸으며 진폭을 받아 적는다 */
  const curveKey = () => `${state.count}${state.line}`;

  function recordWalk() {
    const key = curveKey();
    if (!state.curves[key]) state.curves[key] = [];
    state.curves[key].push({ x: state.walk.x, amp: listen(state.walk.x, LINES[state.line]).sum });
  }

  function stepWalk(dt) {
    const w = state.walk;
    w.x = Math.min(WALK_X, w.x + WALK_SPEED * dt);
    recordWalk();
    if (w.x >= WALK_X) {
      w.on = false;
      updateWalkBtn();
    }
  }

  // 가운데 큰 소리 지점에서 바로 옆 큰 소리 지점까지 — 걸으며 그린 곡선의 봉우리로 잰다.
  // 스피커 가까이는 간격이 고르지 않아서(쌍곡선) 평균 대신 가운데 둘 사이를 쓴다
  function spacingOf(key) {
    const pts = state.curves[key];
    if (!pts || pts.length < 5) return null;
    const peaks = [];
    for (let i = 2; i < pts.length - 2; i++) {
      const a = pts[i].amp;
      if (a > pts[i - 1].amp && a >= pts[i + 1].amp && a > pts[i - 2].amp && a >= pts[i + 2].amp) peaks.push(pts[i].x);
    }
    let mid = -1;
    peaks.forEach((x, k) => { if (Math.abs(x) < 0.5 && (mid < 0 || Math.abs(x) < Math.abs(peaks[mid]))) mid = k; });
    if (mid < 0) return null;
    const side = [peaks[mid - 1], peaks[mid + 1]].filter((x) => x !== undefined).map((x) => Math.abs(x - peaks[mid]));
    return side.length ? Math.min(...side) : null;
  }

  /* 탭 3 — 엔진 소음과 이어폰 소리 (c는 지나간 진동 수) */
  function noiseAt(c) {
    let s = 0;
    for (const [k, a, ph] of NOISE_H) s += a * Math.sin(TAU * k * c + ph);
    return s;
  }
  const antiAt = (c) => noiseAt(c - state.theta / 360);   // 소음보다 위상이 θ만큼 늦은 소리

  // 이어폰 자리에서 한 주기를 받아 적어 기본 진동의 위상 차와 남은 소음의 크기를 잰다
  function measureEarphone() {
    const n = 64;
    let nc = 0;
    let ns = 0;
    let ac = 0;
    let as = 0;
    let n2 = 0;
    let s2 = 0;
    for (let k = 0; k < n; k++) {
      const c = state.cyc - k / n;
      const nv = noiseAt(c);
      const av = state.anc ? antiAt(c) : 0;
      const ang = TAU * c;
      nc += nv * Math.cos(ang);
      ns += nv * Math.sin(ang);
      ac += av * Math.cos(ang);
      as += av * Math.sin(ang);
      n2 += nv * nv;
      s2 += (nv + av) ** 2;
    }
    let theta = ((Math.atan2(nc, ns) - Math.atan2(ac, as)) * 180) / Math.PI;
    theta = ((theta % 360) + 360) % 360;
    return { theta: state.anc ? theta : null, residual: Math.sqrt(s2 / n2) * 100 };
  }

  /* ---------------------------------------------------------
     그리기 — 탭 1·2는 위에서 내려다본 모습 (가로·세로 같은 비율, 원이 원으로 보이게)
     --------------------------------------------------------- */
  function geom(w, h) {
    const padX = 16;
    const padTop = 30;
    const padBottom = 24;
    const ppm = Math.min((w - 2 * padX) / (2 * VIEW_HALF_W), (h - padTop - padBottom) / (VIEW_BOTTOM - VIEW_TOP));
    const cx = w / 2;
    const y0 = padTop - VIEW_TOP * ppm;
    return {
      w, h, ppm,
      X: (x) => cx + x * ppm,
      Y: (y) => y0 + y * ppm,
      toX: (px) => (px - cx) / ppm,
      toY: (py) => (py - y0) / ppm,
    };
  }

  function label(ctx, text, x, y0, color, size = 12, align = "center", weight = "500") {
    ctx.save();
    ctx.font = `${weight} ${size}px Geist, 'Malgun Gothic', sans-serif`;
    ctx.textAlign = align;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";   // 물결 위에서도 읽히게
    ctx.lineWidth = 4;
    ctx.strokeText(text, x, y0);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y0);
    ctx.restore();
  }

  function roundRect(ctx, x, y0, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y0);
    ctx.arcTo(x + w, y0, x + w, y0 + h, r);
    ctx.arcTo(x + w, y0 + h, x, y0 + h, r);
    ctx.arcTo(x, y0 + h, x, y0, r);
    ctx.arcTo(x, y0, x + w, y0, r);
    ctx.closePath();
  }

  // 마루(실선)와 골(점선) — 스피커에서 멀수록 옅게
  function drawFronts(ctx, g, s, alpha) {
    const lam = lambda();
    const sx = g.X(s.x);
    const sy = g.Y(0);
    const rMax = Math.max(Math.hypot(sx, sy), Math.hypot(g.w - sx, sy), Math.hypot(sx, g.h - sy), Math.hypot(g.w - sx, g.h - sy)) / g.ppm;
    ctx.save();
    ctx.strokeStyle = s.color;
    for (const [shift, dash, width] of [[0.25, [], 1.8], [0.75, [5, 6], 1.2]]) {
      const u = state.cyc + s.ph / TAU - shift;
      ctx.setLineDash(dash);
      ctx.lineWidth = width;
      for (let r = lam * (u - Math.floor(u)); r < rMax; r += lam) {
        if (r < 0.12) continue;
        ctx.globalAlpha = alpha * clamp(1.4 / Math.sqrt(r), 0.22, 0.9);
        ctx.beginPath();
        ctx.arc(sx, sy, r * g.ppm, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 세기 지도 — 칸마다 한 주기를 네 번 받아 적어 진폭을 잰다 (사인파는 네 번이면 정확하다).
  // 소리가 한결같아서 설정이 바뀔 때만 다시 그린다
  let mapCanvas = null;
  let mapKey = "";

  function drawMap(ctx, g, sp) {
    const key = [g.w, g.h, state.f, state.d, state.flipB].join("|");
    if (key !== mapKey) {
      buildMap(g, sp);
      mapKey = key;
    }
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(mapCanvas, 0, 0, g.w, g.h);
    ctx.restore();
  }

  function buildMap(g, sp) {
    const cell = 5;
    const cols = Math.ceil(g.w / cell);
    const rows = Math.ceil(g.h / cell);
    if (!mapCanvas) mapCanvas = document.createElement("canvas");
    mapCanvas.width = cols;
    mapCanvas.height = rows;
    const mctx = mapCanvas.getContext("2d");
    const img = mctx.createImageData(cols, rows);
    const lam = lambda();
    for (let j = 0; j < rows; j++) {
      const y = g.toY((j + 0.5) * cell);
      for (let i = 0; i < cols; i++) {
        const x = g.toX((i + 0.5) * cell);
        let s2 = 0;
        for (let k = 0; k < 4; k++) {
          let tot = 0;
          for (const s of sp) tot += wave(s, x, y, k / 4, lam);
          s2 += tot * tot;
        }
        const v = Math.min(1, Math.sqrt(s2 / 2) / AMP_MAP);
        const p = (j * cols + i) * 4;
        for (let ch = 0; ch < 3; ch++) img.data[p + ch] = 255 - v * (255 - MAP_INK[ch]);
        img.data[p + 3] = 255;
      }
    }
    mctx.putImageData(img, 0, 0);
  }

  function drawSpeaker(ctx, g, s) {
    const x = g.X(s.x);
    const y = g.Y(0);
    const w = Math.max(18, 0.5 * g.ppm);
    const h = Math.max(12, 0.32 * g.ppm);
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    roundRect(ctx, x - w / 2, y - h - 2, w, h, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = s.color;   // 소리가 나오는 쪽 (아래)
    ctx.beginPath();
    ctx.moveTo(x - w * 0.28, y - 2);
    ctx.lineTo(x + w * 0.28, y - 2);
    ctx.lineTo(x + w * 0.4, y + 4);
    ctx.lineTo(x - w * 0.4, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    label(ctx, s.name || "스피커", x, y - h - 9, s.color, s.name ? 14 : 12, "center", "600");
  }

  function drawListener(ctx, g, x, y, name) {
    const px = g.X(x);
    const py = g.Y(y);
    ctx.save();
    ctx.fillStyle = COLOR_INK;
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, TAU);
    ctx.fill();
    ctx.restore();
    label(ctx, name, px, py + 26, COLOR_INK, 12, "center", "600");
  }

  // 탭 1 — 두 스피커에서 듣는 사람까지의 거리
  function drawPaths(ctx, g, sp) {
    const ex = g.X(state.ear.x);
    const ey = g.Y(state.ear.y);
    sp.forEach((s) => {
      const sx = g.X(s.x);
      const sy = g.Y(0);
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.restore();
      const r = Math.hypot(state.ear.x - s.x, state.ear.y);
      const left = s.x < state.ear.x;
      label(ctx, `${r.toFixed(2)} m`, (sx + ex) / 2 + (left ? -8 : 8), (sy + ey) / 2, s.color, 12, left ? "right" : "left", "600");
    });
  }

  // 탭 2 — 걷는 두 줄과, 걸으며 잰 진폭 곡선 (그림 III-21처럼 줄 위로 솟게)
  function drawWalk(ctx, g) {
    for (const key of ["near", "far"]) {
      const yy = g.Y(LINES[key]);
      const on = key === state.line;
      ctx.save();
      ctx.strokeStyle = on ? COLOR_INK : COLOR_LINE;
      ctx.lineWidth = on ? 1.5 : 1;
      ctx.setLineDash(on ? [] : [5, 5]);
      ctx.beginPath();
      ctx.moveTo(g.X(-WALK_X), yy);
      ctx.lineTo(g.X(WALK_X), yy);
      ctx.stroke();
      ctx.restore();
      label(ctx, `${key === "near" ? "가까운 줄" : "먼 줄"} · ${LINES[key]} m`, g.X(-WALK_X), yy + 17, on ? COLOR_INK : COLOR_MUTE, 12, "left", "600");
    }
    const cur = curveKey();
    Object.keys(state.curves).forEach((key) => { if (key !== cur) drawCurve(ctx, g, key, false); });
    drawCurve(ctx, g, cur, true);
    drawListener(ctx, g, state.walk.x, LINES[state.line], "듣는 사람");
  }

  function drawCurve(ctx, g, key, strong) {
    const pts = state.curves[key];
    if (!pts || pts.length < 2) return;
    const base = g.Y(LINES[key.slice(1)]);
    const yOf = (amp) => base - amp * CURVE_M * g.ppm;
    ctx.save();
    if (strong) {
      ctx.fillStyle = "rgba(23, 23, 23, 0.07)";
      ctx.beginPath();
      ctx.moveTo(g.X(pts[0].x), base);
      pts.forEach((p) => ctx.lineTo(g.X(p.x), yOf(p.amp)));
      ctx.lineTo(g.X(pts[pts.length - 1].x), base);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = strong ? COLOR_INK : "#c4c4c4";
    ctx.lineWidth = strong ? 2 : 1.3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(g.X(p.x), yOf(p.amp)) : ctx.moveTo(g.X(p.x), yOf(p.amp))));
    ctx.stroke();
    ctx.restore();
    // 가장 높은 곳 위에 스피커 수 — 같은 줄에 1개·2개 곡선이 겹쳐도 구별되게
    let top = pts[0];
    pts.forEach((p) => { if (p.amp > top.amp) top = p; });
    label(ctx, `스피커 ${key[0]}개`, g.X(top.x), yOf(top.amp) - 7, strong ? COLOR_INK : COLOR_MUTE, 11, "center", "600");
  }

  function drawScale(ctx, g) {
    const x0 = 16;
    const y0 = g.h - 14;
    ctx.save();
    ctx.strokeStyle = COLOR_BODY;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0 - 5);
    ctx.lineTo(x0, y0);
    ctx.lineTo(x0 + g.ppm, y0);
    ctx.lineTo(x0 + g.ppm, y0 - 5);
    ctx.stroke();
    ctx.restore();
    label(ctx, "1 m", x0 + g.ppm + 6, y0 + 4, COLOR_BODY, 11, "left");
  }

  /* 탭 3 — 그림 III-24를 본뜬 모식도. 소음이 왼쪽에서 들어와 이어폰을 지나 고막에 닿는다 */
  function renderTab3(ctx, w, h) {
    const left = 36;
    const xe = Math.round(w * 0.58);
    const xEar = w - 60;
    const y0 = Math.round(h * 0.5);
    const amp = (h * 0.16) / noisePeak;
    const lamPx = (xe - left) / 2.3;
    const at = (x) => state.cyc - (x - left) / lamPx;   // x에 닿은 소리는 이만큼 앞서 나온 것
    const line = (x1, x2, fn, color, width, dash) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let x = x1; x <= x2; x += 2) {
        const yy = y0 - fn(x) * amp;
        if (x === x1) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
      ctx.restore();
    };
    ctx.save();
    ctx.strokeStyle = "#ececec";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, y0 + 0.5);
    ctx.lineTo(xEar, y0 + 0.5);
    ctx.stroke();
    ctx.restore();

    const top = y0 - noisePeak * amp;
    line(left, xe, (x) => noiseAt(at(x)), COLOR_NOISE, 2.5, []);
    if (state.anc) {
      line(xe, xEar, (x) => noiseAt(at(x)), COLOR_NOISE, 1.5, [5, 5]);
      line(xe, xEar, (x) => antiAt(at(x)), COLOR_ANTI, 2.5, []);
      line(xe, xEar, (x) => noiseAt(at(x)) + antiAt(at(x)), COLOR_INK, 3, []);
    } else {
      line(xe, xEar, (x) => noiseAt(at(x)), COLOR_INK, 3, []);
    }
    drawEarphone(ctx, xe, y0, h);
    drawEardrum(ctx, xEar, y0, h);
    label(ctx, "외부 소음", left + 4, top - 14, COLOR_BODY, 13, "left", "600");
    if (state.anc) {
      label(ctx, "반대 위상의 소리", xe + 26, y0 + noisePeak * amp + 26, COLOR_ANTI, 13, "left", "600");
      label(ctx, "귀에 들리는 소리", xEar - 14, top - 14, COLOR_INK, 13, "right", "600");
    } else {
      label(ctx, "귀에 들리는 소리 = 외부 소음", xEar - 14, top - 14, COLOR_INK, 13, "right", "600");
    }
  }

  function drawEarphone(ctx, x, y0, h) {
    const bw = 30;
    const bh = h * 0.46;
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = "#f5f5f5";
    ctx.strokeStyle = COLOR_BODY;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x - bw / 2, y0 - bh / 2, bw, bh, 12);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLOR_INK;   // 마이크 — 바깥쪽
    ctx.beginPath();
    ctx.arc(x - bw / 2, y0 - bh * 0.32, 4.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = state.anc ? COLOR_ANTI : COLOR_MUTE;   // 스피커 — 귀 쪽 면
    roundRect(ctx, x + bw / 2 - 3, y0 + bh * 0.18, 6, 18, 2);
    ctx.fill();
    ctx.restore();
    label(ctx, "마이크", x - bw / 2 - 8, y0 - bh * 0.32 + 4, COLOR_BODY, 11, "right", "600");
    label(ctx, "스피커", x + bw / 2 + 8, y0 + bh * 0.18 + 13, state.anc ? COLOR_ANTI : COLOR_BODY, 11, "left", "600");
    label(ctx, "이어폰", x, y0 + bh / 2 + 18, COLOR_INK, 13, "center", "600");
  }

  function drawEardrum(ctx, x, y0, h) {
    ctx.save();
    ctx.strokeStyle = COLOR_BODY;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + 6, y0 - h * 0.2);
    ctx.quadraticCurveTo(x - 4, y0, x + 6, y0 + h * 0.2);
    ctx.stroke();
    ctx.restore();
    label(ctx, "고막", x + 4, y0 + h * 0.2 + 18, COLOR_BODY, 12, "center", "600");
  }

  function render() {
    const { w, h, ctx } = SimUtils.fitCanvas(canvas);
    ctx.fillStyle = COLOR_STAGE;
    ctx.fillRect(0, 0, w, h);
    if (state.tab === 3) {
      lastG = null;
      renderTab3(ctx, w, h);
      return;
    }
    const g = geom(w, h);
    lastG = g;
    const sp = speakers();
    if (state.tab === 1 && state.view === "map") drawMap(ctx, g, sp);
    else sp.forEach((s) => drawFronts(ctx, g, s, state.tab === 1 ? 1 : 0.4));
    if (state.tab === 1) drawPaths(ctx, g, sp);
    else drawWalk(ctx, g);
    sp.forEach((s) => drawSpeaker(ctx, g, s));
    if (state.tab === 1) drawListener(ctx, g, state.ear.x, state.ear.y, "듣는 사람");
    drawScale(ctx, g);
  }

  // 카드 그래프 — 최근 몇 주기의 변위. spec: { scale, series: [{ fn(c), color, width, dash }] }
  function drawStrip(cv, spec) {
    const { w, h, ctx } = SimUtils.fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    if (!spec) return;
    const mid = Math.round(h / 2) + 0.5;
    ctx.strokeStyle = "#e6e6e6";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();
    const k = (h * 0.44) / Math.max(spec.scale, 1e-6);
    const n = Math.max(60, Math.round(w / 2));
    spec.series.forEach((s) => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width || 1.6;
      ctx.setLineDash(s.dash || []);
      ctx.beginPath();
      for (let j = 0; j <= n; j++) {
        const c = state.cyc - STRIP_PERIODS * (1 - j / n);
        const px = (j / n) * w;
        const py = mid - clamp(s.fn(c) * k, -h / 2 + 1, h / 2 - 1);
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  /* ---------------------------------------------------------
     카드 — 탭마다 내용을 바꿔 끼운다
     --------------------------------------------------------- */
  const loudTag = (kind) => (kind === "보강" ? { text: "보강 간섭", cls: "is-loud" } : kind === "상쇄" ? { text: "상쇄 간섭" } : null);

  function cardsTab1() {
    const [A, B] = speakers();
    const ex = state.ear.x;
    const ey = state.ear.y;
    const lam = lambda();
    const rA = Math.hypot(ex - A.x, ey);
    const rB = Math.hypot(ex - B.x, ey);
    const diff = Math.abs(rA - rB);
    const n = diff / lam;
    const off = Math.abs(n - Math.round(n));
    const m = listen(ex, ey);
    heard = m.sum;
    const kind = judge(m.each[0], m.each[1], m.sum);
    const fa = (c) => wave(A, ex, ey, c, lam);
    const fb = (c) => wave(B, ex, ey, c, lam);
    return [
      {
        name: "거리 차",
        tag: off < 0.04 ? { text: "파장의 정수배" } : off > 0.46 ? { text: "반 정수배" } : null,
        sym: "", val: n.toFixed(2), unit: "λ",
        rows: [
          { k: "A까지", v: `${rA.toFixed(2)} m`, cls: "is-a" },
          { k: "B까지", v: `${rB.toFixed(2)} m`, cls: "is-b" },
        ],
        strip: { scale: Math.max(m.each[0], m.each[1]), series: [{ fn: fa, color: COLOR_A }, { fn: fb, color: COLOR_B }] },
        legend: [{ color: COLOR_A, text: "A의 소리" }, { color: COLOR_B, text: "B의 소리" }],
        f1: `${diff.toFixed(2)} m ÷ 파장 ${lam.toFixed(2)} m = ${n.toFixed(2)}`,
      },
      {
        name: "합쳐진 소리", spk: true,
        tag: loudTag(kind),
        sym: "진폭", val: m.sum.toFixed(2), unit: "",
        rows: [
          { k: "A만", v: m.each[0].toFixed(2), cls: "is-a" },
          { k: "B만", v: m.each[1].toFixed(2), cls: "is-b" },
        ],
        strip: { scale: m.each[0] + m.each[1], series: [{ fn: (c) => fa(c) + fb(c), color: COLOR_INK, width: 2 }] },
        legend: [{ color: COLOR_INK, text: "A + B" }],
        f1: kind === "보강" ? "마루와 마루가 만나 진폭이 커진다" : kind === "상쇄" ? "마루와 골이 만나 진폭이 작아진다" : "보강과 상쇄 사이",
      },
    ];
  }

  function cardsTab2() {
    const sp = speakers();
    const two = sp.length === 2;
    const ex = state.walk.x;
    const ey = LINES[state.line];
    const lam = lambda();
    const m = listen(ex, ey);
    heard = m.sum;
    const kind = two ? judge(m.each[0], m.each[1], m.sum) : "";
    const gap = two ? spacingOf(curveKey()) : null;
    const gNear = spacingOf("2near");
    const gFar = spacingOf("2far");
    const w = state.walk;
    let note = "가운데 큰 소리 지점과 바로 옆 지점 사이 · 두 줄을 모두 걸어 보자";
    if (!two) note = "스피커가 하나면 큰 소리 지점도 가운데 하나다";
    else if (gNear != null && gFar != null) note = gNear < gFar ? "스피커에서 먼 줄일수록 간격이 넓다" : "가까운 줄의 간격이 더 넓다";
    return [
      {
        name: "듣는 사람", spk: true,
        tag: loudTag(kind),
        sym: "진폭", val: m.sum.toFixed(2), unit: "",
        rows: [
          { k: "위치", v: `${ex >= 0 ? "+" : "−"}${Math.abs(ex).toFixed(1)} m` },
          { k: "줄", v: `${state.line === "near" ? "가까운" : "먼"} 줄 ${ey} m` },
        ],
        strip: {
          scale: m.each.reduce((s, a) => s + a, 0),
          series: [{ fn: (c) => sp.reduce((s, sk) => s + wave(sk, ex, ey, c, lam), 0), color: COLOR_INK, width: 2 }],
        },
        legend: [{ color: COLOR_INK, text: two ? "A + B" : "스피커 1개" }],
        f1: w.on ? "걸으며 진폭을 줄 위에 그린다" : w.x >= WALK_X ? "다시 걸으면 처음부터 그린다" : "걷기를 누르면 왼쪽 끝부터 걷는다",
      },
      {
        name: "큰 소리 지점 사이 간격",
        tag: null,
        sym: "", val: gap != null ? gap.toFixed(2) : null, unit: "m",
        rows: [
          { k: "가까운 줄", v: gNear != null ? `${gNear.toFixed(2)} m` : "–" },
          { k: "먼 줄", v: gFar != null ? `${gFar.toFixed(2)} m` : "–" },
        ],
        strip: null,
        legend: [],
        f1: note,
      },
    ];
  }

  function cardsTab3() {
    heard = 0;
    const e = measureEarphone();
    const on = state.anc;
    const opposite = on && Math.abs(e.theta - 180) < 3;
    const same = on && (e.theta < 3 || e.theta > 357);
    const sum = (c) => noiseAt(c) + (on ? antiAt(c) : 0);
    let f1 = "외부 소음이 그대로 들린다";
    if (on && e.residual < 5) f1 = state.music ? "소음만 사라지고 음악은 그대로 들린다" : "소음이 거의 사라졌다";
    else if (on) f1 = "위상이 어긋나 소음이 남는다";
    return [
      {
        name: "이어폰이 낸 소리",
        tag: !on ? { text: "꺼짐" } : opposite ? { text: "반대 위상", cls: "is-anti" } : same ? { text: "같은 위상" } : null,
        sym: "위상 차", val: on ? e.theta.toFixed(0) : null, unit: "°",
        rows: [
          { k: "외부 소음", v: `${NOISE_F} Hz` },
          { k: "소음 제거", v: on ? "켜짐" : "꺼짐" },
        ],
        strip: {
          scale: noisePeak,
          series: on ? [{ fn: noiseAt, color: COLOR_NOISE }, { fn: antiAt, color: COLOR_ANTI }] : [{ fn: noiseAt, color: COLOR_NOISE }],
        },
        legend: on
          ? [{ color: COLOR_NOISE, text: "외부 소음" }, { color: COLOR_ANTI, text: "이어폰 소리" }]
          : [{ color: COLOR_NOISE, text: "외부 소음" }],
        f1: on ? "마이크로 잰 소음과 위상이 반대인 소리를 낸다" : "소음 제거를 켜 보자",
      },
      {
        name: "귀에 들리는 소리", spk: true,
        tag: on && e.residual < 5 ? { text: "상쇄 간섭" } : on && e.residual > 150 ? { text: "보강 간섭", cls: "is-loud" } : null,
        sym: "소음", val: e.residual.toFixed(0), unit: "%",
        rows: [
          { k: "외부 소음", v: "100 %" },
          { k: "음악", v: state.music ? "들림" : "꺼짐" },
        ],
        strip: {
          scale: 2 * noisePeak,
          series: [{ fn: noiseAt, color: COLOR_NOISE, width: 1.2, dash: [3, 3] }, { fn: sum, color: COLOR_INK, width: 2 }],
        },
        legend: [{ color: COLOR_NOISE, text: "외부 소음", dash: true }, { color: COLOR_INK, text: "귀에 들리는 소음" }],
        f1,
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
      el.v[i].className = r.cls || "";
    });
    el.spk.classList.toggle("hidden", !m.spk);
    el.strip.classList.toggle("hidden", !m.strip);
    const leg = m.legend.map((l) => `<span><i class="${l.dash ? "dash" : ""}" style="border-color:${l.color}"></i>${l.text}</span>`).join("");
    if (el.legendKey !== leg) {
      el.legend.innerHTML = leg;
      el.legendKey = leg;
    }
    el.f1.textContent = m.f1 || "";
  }

  /* ---------------------------------------------------------
     소리 — 탭 1·2는 듣는 자리의 진폭만큼 큰 실제 진동수의 음,
     탭 3은 엔진 소음(이어폰 소리와 더한 것)과 음악
     --------------------------------------------------------- */
  const audio = { ctx: null, tone: null, toneGain: null, noise: null, noiseGain: null, mOsc: null, mEnv: null, mGain: null, nextNote: 0, note: 0, waveKey: "", last: {} };

  function startAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      toast("이 브라우저에서는 소리를 낼 수 없다");
      return false;
    }
    const ac = new AC();
    audio.ctx = ac;
    const chain = (src, gain) => {
      gain.gain.value = 0;
      src.connect(gain);
      gain.connect(ac.destination);
      if (src.start) src.start();
    };
    audio.tone = ac.createOscillator();
    audio.toneGain = ac.createGain();
    chain(audio.tone, audio.toneGain);
    audio.noise = ac.createOscillator();
    audio.noise.frequency.value = NOISE_F;
    audio.noiseGain = ac.createGain();
    chain(audio.noise, audio.noiseGain);
    audio.mOsc = ac.createOscillator();
    audio.mOsc.type = "triangle";
    audio.mEnv = ac.createGain();
    audio.mEnv.gain.value = 0;
    audio.mOsc.connect(audio.mEnv);
    audio.mGain = ac.createGain();
    chain(audio.mEnv, audio.mGain);
    audio.mOsc.start();
    audio.nextNote = ac.currentTime + 0.1;
    return true;
  }

  // 귀에 들리는 소음 — 배음마다 소음과 이어폰 소리를 더한 파형. 정규화하면 남은 소음이 다시 커지므로 끈다
  function noiseWave() {
    const real = new Float32Array(8);
    const imag = new Float32Array(8);
    const th = (state.theta * Math.PI) / 180;
    for (const [k, a, ph] of NOISE_H) {
      for (const p of state.anc ? [ph, ph - k * th] : [ph]) {
        imag[k] += a * Math.cos(p);
        real[k] += a * Math.sin(p);
      }
    }
    return audio.ctx.createPeriodicWave(real, imag, { disableNormalization: true });
  }

  function scheduleMusic() {
    const ac = audio.ctx;
    if (audio.nextNote < ac.currentTime) audio.nextNote = ac.currentTime + 0.05;   // 숨었다 돌아오면 밀린 음은 건너뛴다
    while (audio.nextNote < ac.currentTime + 0.3) {
      const [deg, beats] = MELODY[audio.note];
      const t0 = audio.nextNote;
      const dur = beats * BEAT;
      if (deg !== null) {
        const g = audio.mEnv.gain;
        audio.mOsc.frequency.setValueAtTime(SCALE[deg], t0);
        g.setValueAtTime(0, t0);
        g.linearRampToValueAtTime(1, t0 + 0.015);
        g.setTargetAtTime(0, t0 + 0.04, dur * 0.3);
      }
      audio.nextNote += dur;
      audio.note = (audio.note + 1) % MELODY.length;
    }
  }

  // 값이 바뀔 때만 예약한다 — 매 프레임 예약하면 자동화 목록이 쌓인다
  function setLevel(name, param, value, tc) {
    if (Math.abs((audio.last[name] ?? -1) - value) < 1e-4) return;
    audio.last[name] = value;
    param.setTargetAtTime(value, audio.ctx.currentTime, tc);
  }

  function updateSound() {
    if (!audio.ctx) return;
    const on = state.sound && !state.paused && !document.hidden;
    let tone = 0;
    let noise = 0;
    let music = 0;
    if (on && state.tab !== 3) {
      setLevel("f", audio.tone.frequency, state.f, 0.02);
      tone = VOL_TONE * Math.min(1, heard / AMP_LOUD);
    } else if (on) {
      const key = `${state.anc}|${state.theta}`;
      if (key !== audio.waveKey) {
        audio.noise.setPeriodicWave(noiseWave());
        audio.waveKey = key;
      }
      noise = VOL_NOISE;
      if (state.music) music = VOL_MUSIC;
    }
    setLevel("tone", audio.toneGain.gain, tone, 0.03);
    setLevel("noise", audio.noiseGain.gain, noise, 0.03);
    setLevel("music", audio.mGain.gain, music, 0.05);
    scheduleMusic();
  }

  function toggleSound() {
    if (!audio.ctx && !startAudio()) return;
    if (audio.ctx.state === "suspended") audio.ctx.resume();
    state.sound = !state.sound;
    cardEls.forEach((el) => {
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

  function setTab(n) {
    if (n === state.tab) return;
    state.tab = n;
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("is-active", Number(b.dataset.tab) === n));
    document.querySelectorAll(".ctrl-pane").forEach((p) => p.classList.toggle("hidden", Number(p.dataset.pane) !== n));
    updateStatus();
    lastCards = 0;
  }

  function syncSegs() {
    document.querySelectorAll("#phaseSeg button").forEach((b) => b.classList.toggle("is-active", (b.dataset.flip === "1") === state.flipB));
    document.querySelectorAll("#viewSeg button").forEach((b) => b.classList.toggle("is-active", b.dataset.view === state.view));
    document.querySelectorAll("#countSeg button").forEach((b) => b.classList.toggle("is-active", Number(b.dataset.count) === state.count));
    document.querySelectorAll("#lineSeg button").forEach((b) => b.classList.toggle("is-active", b.dataset.line === state.line));
    $("ancBtn").classList.toggle("is-on", state.anc);
    $("ancBtn").setAttribute("aria-pressed", String(state.anc));
    $("musicBtn").classList.toggle("is-on", state.music);
    $("musicBtn").setAttribute("aria-pressed", String(state.music));
  }

  // 간격·진동수가 바뀌면 걸으며 그린 곡선은 더 이상 맞지 않는다
  function clearCurves() {
    state.curves = {};
    state.walk.on = false;
    state.walk.x = -WALK_X;
    updateWalkBtn();
  }

  function setF(v) {
    const f = Math.round(clamp(Number(v) || 340, F_MIN, F_MAX) / 10) * 10;
    document.querySelectorAll(".f-input").forEach((el) => { el.value = f; });
    document.querySelectorAll(".f-num").forEach((el) => { el.value = f; });
    if (f === state.f) return;
    state.f = f;
    clearCurves();
    updateStatus();
  }

  function setD(v) {
    const d = Math.round(clamp(Number(v) || 2, D_MIN, D_MAX) * 2) / 2;
    document.querySelectorAll(".d-input").forEach((el) => { el.value = d; });
    document.querySelectorAll(".d-num").forEach((el) => { el.value = d.toFixed(1); });
    if (d === state.d) return;
    state.d = d;
    clearCurves();
    updateStatus();
  }

  function setTheta(v) {
    const th = Math.round(clamp(Number(v) || 0, 0, 360) / 15) * 15;
    state.theta = th;
    $("thetaInput").value = th;
    $("thetaNum").value = th;
  }

  function setFlip(flip) {
    state.flipB = flip;
    syncSegs();
    updateStatus();
  }

  function setView(view) {
    state.view = view;
    syncSegs();
  }

  // 줄이나 스피커 수를 바꾸면 그 설정의 곡선을 새로 그릴 수 있게 왼쪽 끝으로 돌아간다
  function setCount(n) {
    if (n === state.count) return;
    state.count = n;
    state.walk.on = false;
    state.walk.x = -WALK_X;
    syncSegs();
    updateWalkBtn();
    updateStatus();
  }

  function setLine(line) {
    if (line === state.line) return;
    state.line = line;
    state.walk.on = false;
    state.walk.x = -WALK_X;
    syncSegs();
    updateWalkBtn();
  }

  function toggleWalk() {
    const w = state.walk;
    if (w.on) {
      w.on = false;
    } else {
      if (w.x >= WALK_X || w.x <= -WALK_X) {
        w.x = -WALK_X;
        state.curves[curveKey()] = [];
        recordWalk();
      }
      w.on = true;
      if (state.paused) togglePause();
    }
    updateWalkBtn();
  }

  function updateWalkBtn() {
    const w = state.walk;
    $("walkBtn").textContent = w.on ? "멈춤" : w.x >= WALK_X ? "다시 걷기" : w.x > -WALK_X ? "이어 걷기" : "걷기";
  }

  function toggleAnc() {
    state.anc = !state.anc;
    syncSegs();
    updateStatus();
  }

  function toggleMusic() {
    state.music = !state.music;
    syncSegs();
  }

  function togglePause() {
    state.paused = !state.paused;
    $("pauseBtn").textContent = state.paused ? "계속" : "일시정지";
    updateStatus();
    updateSound();
  }

  function reset() {
    if (state.tab === 1) {
      state.ear = { ...EAR_START };
      state.flipB = false;
    } else if (state.tab === 2) {
      clearCurves();
    } else {
      state.anc = false;
      state.music = true;
      setTheta(180);
    }
    syncSegs();
    updateStatus();
    if (state.paused) togglePause();
  }

  function updateStatus() {
    const lam = lambda().toFixed(2);
    let tag;
    if (state.tab === 1) tag = `${state.f} Hz · 파장 ${lam} m · 간격 ${state.d} m${state.flipB ? " · B 반대 위상" : ""}`;
    else if (state.tab === 2) tag = `스피커 ${state.count}개 · ${state.f} Hz · 파장 ${lam} m`;
    else tag = `엔진 소음 ${NOISE_F} Hz · 소음 제거 ${state.anc ? "켜짐" : "꺼짐"}`;
    if (state.paused) tag += " · 일시정지";
    $("statusTag").textContent = tag;
    const pace = `한 번 진동에 ${state.period}초`;
    $("stageHint").textContent = state.tab === 1 ? `듣는 사람을 끌거나 무대를 눌러 옮긴다 · ${pace}`
      : state.tab === 2 ? `걷는 빠르기 ${WALK_SPEED} m/s · ${pace}`
        : `그림 III-24를 본뜬 모식도 · ${pace}`;
  }

  /* 탭 1 — 듣는 사람을 끌어 옮긴다 (마우스·터치 모두). 무대를 누르면 그 자리로 간다 */
  function bindDrag() {
    let dragging = false;
    const toWorld = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: lastG.toX(e.clientX - r.left), y: lastG.toY(e.clientY - r.top) };
    };
    const moveEar = (p) => {
      const g = lastG;
      state.ear.x = clamp(p.x, g.toX(20), g.toX(g.w - 20));
      state.ear.y = clamp(p.y, 0.3, g.toY(g.h - 34));
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (state.tab !== 1 || !lastG) return;
      const p = toWorld(e);
      if (p.y < 0.3) return;
      e.preventDefault();
      dragging = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 포인터가 이미 사라졌으면 잡지 않고 진행 */ }
      moveEar(p);
      canvas.style.cursor = "grabbing";
    });
    canvas.addEventListener("pointermove", (e) => {
      if (state.tab !== 1 || !lastG) {
        canvas.style.cursor = "default";
        return;
      }
      const p = toWorld(e);
      if (dragging) {
        moveEar(p);
        return;
      }
      const near = Math.hypot(p.x - state.ear.x, p.y - state.ear.y) * lastG.ppm < 18;
      canvas.style.cursor = near ? "grab" : p.y >= 0.3 ? "pointer" : "default";
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      canvas.style.cursor = "grab";
    };
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
    if (!state.paused && dt > 0) {
      state.cyc += dt / state.period;
      if (state.tab === 2 && state.walk.on) stepWalk(dt);
    }
    render();
    models = state.tab === 1 ? cardsTab1() : state.tab === 2 ? cardsTab2() : cardsTab3();
    cardEls.forEach((el, i) => drawStrip(el.strip, models[i].strip));
    if (ts - lastCards > 100) {
      cardEls.forEach((el, i) => applyCard(el, models[i]));
      lastCards = ts;
    }
    updateSound();
    requestAnimationFrame(frame);
  }

  function bind() {
    $("pauseBtn").addEventListener("click", togglePause);
    $("resetBtn").addEventListener("click", reset);
    document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => setTab(Number(b.dataset.tab))));
    document.querySelectorAll("#phaseSeg button").forEach((b) => b.addEventListener("click", () => setFlip(b.dataset.flip === "1")));
    document.querySelectorAll("#viewSeg button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
    document.querySelectorAll("#countSeg button").forEach((b) => b.addEventListener("click", () => setCount(Number(b.dataset.count))));
    document.querySelectorAll("#lineSeg button").forEach((b) => b.addEventListener("click", () => setLine(b.dataset.line)));
    $("walkBtn").addEventListener("click", toggleWalk);
    $("ancBtn").addEventListener("click", toggleAnc);
    $("musicBtn").addEventListener("click", toggleMusic);
    document.querySelectorAll(".d-input").forEach((el) => el.addEventListener("input", (e) => setD(e.target.value)));
    document.querySelectorAll(".d-num").forEach((el) => el.addEventListener("change", (e) => setD(e.target.value)));
    document.querySelectorAll(".f-input").forEach((el) => el.addEventListener("input", (e) => setF(e.target.value)));
    document.querySelectorAll(".f-num").forEach((el) => el.addEventListener("change", (e) => setF(e.target.value)));
    $("thetaInput").addEventListener("input", (e) => setTheta(e.target.value));
    $("thetaNum").addEventListener("change", (e) => setTheta(e.target.value));
    document.querySelectorAll(".num").forEach((el) =>
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); }));
    cardEls.forEach((el) => el.spk.addEventListener("click", toggleSound));
    $("periodSelect").addEventListener("change", (e) => {
      state.period = Number(e.target.value);
      updateStatus();
    });
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
        k: [q("k1"), q("k2")], v: [q("v1"), q("v2")], strip: q("strip"), legend: q("legend"), f1: q("f1"), legendKey: null,
      };
    });
    for (let i = 0; i < 400; i++) noisePeak = Math.max(noisePeak, Math.abs(noiseAt(i / 400)));
    bind();
    document.querySelectorAll(".f-input, .f-num").forEach((el) => { el.value = state.f; });
    document.querySelectorAll(".d-input").forEach((el) => { el.value = state.d; });
    document.querySelectorAll(".d-num").forEach((el) => { el.value = state.d.toFixed(1); });
    setTheta(state.theta);
    syncSegs();
    updateStatus();
    updateWalkBtn();
    requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
