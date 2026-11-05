/* ============================================================
   등속 원운동 시뮬레이터
   교과서: (동아출판) 역학과 에너지 pp.22~26 「03 원운동」
   성취기준: [12역학01-03]

   1단계 각속도       ω = Δθ/Δt, ω = 2π/T, v = rω        (p.23)
   2단계 구심 가속도  Δv = v₂ − v₁ → a = vω = rω² = v²/r  (p.24)
   3단계 구심력       F = mv²/r, 줄을 끊으면 접선 방향     (p.24~25)
   ============================================================ */

(() => {
  "use strict";

  /* ---------------------------------------------------------
     캔버스에 직접 그리는 색.
     CSS의 --accent 등과는 별개의 하드코딩 상수다.
     색을 바꿀 때는 circular-motion.css와 여기를 함께 고쳐야 한다.

     배색 원칙 — 색 = 방향 계열
       흰색     : v (접선). 이 그림에서 유일하게 방향이 다른 벡터
       라벤더계 : Δv, a, F (전부 중심 방향) → 같은 계열로 묶어 평행함을 드러낸다
       회색     : 원 궤도·반지름·각 등 무대 장치
     --------------------------------------------------------- */
  const COLOR_STAGE  = "#0a0b0c";
  const COLOR_SUNKEN = "#0b0c0d";
  const COLOR_GRID   = "#1b1d21";
  const COLOR_HAIRLINE = "#23252a";
  const COLOR_AXIS   = "#2b2e34";
  const COLOR_GEOM   = "#8a8f98";
  const COLOR_LABEL  = "#62666d";
  const COLOR_V      = "#f7f8f8";
  const COLOR_DV     = "#5e6ad2";
  const COLOR_ACC    = "#828fff";
  const COLOR_FORCE  = "#5e6ad2";
  const COLOR_SECOND = "#7a7fad";
  const COLOR_GHOST  = "#4a4d55";

  const V_MIN = 0.4,  V_MAX = 12;
  const T_MIN = 0.6,  T_MAX = 8;
  const R_MIN = 0.5,  R_MAX = 4;
  const R2_MIN = 0.3, R2_MAX = 4;
  const MARK_DT = 1.0;   // 1단계에서 "앞으로 회전할 각"을 보는 시간 창(s)
  const F_REF = 6;       // 구심력 화살표 길이의 기준 크기(N)
  const A_REF = 10;      // 구심 가속도 화살표 길이의 기준 크기(m/s²)
  const TAU = Math.PI * 2;

  /* 전체 화면 유도 — 호/현이 화면에서 너무 작아지면 돋보기 상자를 함께 그린다 */
  const LENS_FILL = 0.5;    // 돋보기 안에서 현이 차지할 비율
  const LENS_MIN = 1.4;     // 이 배율 미만이면 돋보기를 띄우지 않는다

  /* Δθ 는 로그 눈금으로 다룬다. 1°~90° 를 선형으로 두면 작은 각 쪽이 슬라이더
     맨 끝 몇 픽셀에 몰려 조작이 안 되기 때문이다.
     하한 0.01° 는 "더 줄여도 숫자를 읽을 수 없는" 지점이다
     (이미 현의 길이가 화면에서 0.1픽셀 아래로 내려간다). */
  const DTH_MAX = 90;
  const DTH_MIN = 0.01;
  const DTH_STEPS = 1000;
  /* 「극한으로」는 프레임 수가 아니라 실제 경과 시간으로 각을 정한다.
     탭이 뒤로 가거나 화면이 느려도 걸리는 시간이 항상 같도록. */
  const LIMIT_MS = 12000;

  /* 속도 화살표는 길이 ∝ 속력. v = V_MAX일 때 궤도 반지름의 0.85배가 된다.
     (드래그로 화살표를 늘려 v를 조절하므로 길이 보정을 걸면 되먹임이 생긴다.) */
  const V_ARROW_FRAC = 0.85;

  const GRAB_TIP = 14;   // 화살표 끝 잡기 반경(px)
  const GRAB_BALL = 13;  // 물체 잡기 반경(px)

  /* ---------------------------------------------------------
     상태
     --------------------------------------------------------- */
  const state = {
    r: 2, T: 3, v: 0, omega: 0, m: 1,
    driver: "T",          // "T" | "v" — 마지막으로 사용자가 직접 건드린 쪽
    theta: 0,

    // 물체 B — A와의 관계를 세 가지 중에서 고른다
    showSecond: false,
    linkMode: "omega",    // "omega" | "speed" | "free"
    r2: 1, T2: 3, v2: 0, omega2: 0,
    // 질량은 linkMode에 묶이지 않는다 — 구심력 F = m v²/r 을 비교할 때
    // 질량도 독립 변수여야 하므로 A와 따로 둔다.
    m2: 1,
    driver2: "T",
    theta2: 0,

    running: false,
    step: 1,
    dthetaDeg: 60,
    deriveOpen: false,
    velAlign: 0,          // 0 = 실제 방향(r 과 수직), 1 = ①과 나란히
    cut: false, cutPos: null, cutVel: null, cutT: 0, escaped: false,
  };

  const $ = (id) => document.getElementById(id);

  const canvas = $("simCanvas");
  const vecCanvas = $("vecCanvas");
  const posCanvas = $("posCanvas");
  const velCanvas = $("velCanvas");
  const statusTag = $("statusTag");
  const legend = $("legend");

  /* ---------------------------------------------------------
     보조 함수
     --------------------------------------------------------- */
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  function fmt(n, d = 2) {
    if (!isFinite(n)) return "–";
    return n.toFixed(d);
  }

  /** 원 위 각도 th에서의 위치(월드 좌표, 반지름 rad) */
  function posAt(th, rad) {
    return { x: rad * Math.cos(th), y: rad * Math.sin(th) };
  }

  /** 각도 th에서의 접선 속도 벡터(반시계 방향 회전) */
  function velAt(th, speed) {
    return { x: -speed * Math.sin(th), y: speed * Math.cos(th) };
  }

  function arrowPx(ctx, x1, y1, x2, y2, color, width) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    SimUtils.arrow(ctx, x1, y1, x2, y2);
    ctx.restore();
  }

  function label(ctx, text, x, y, color, size = 11) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${size}px 'JetBrains Mono', monospace`;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /** 오른쪽 끝을 x에 맞춰 글자를 쓴다 */
  function labelRight(ctx, text, x, y, color, size = 11) {
    ctx.save();
    ctx.font = `${size}px 'JetBrains Mono', monospace`;
    const wd = ctx.measureText(text).width;
    ctx.fillStyle = color;
    ctx.fillText(text, x - wd, y);
    ctx.restore();
    return wd;
  }

  /** 배경이 깔린 라벨 — 선 위에 겹쳐도 읽히게 한다 */
  function chip(ctx, text, x, y, color, size = 12, align = "right") {
    ctx.save();
    ctx.font = `${size}px 'JetBrains Mono', monospace`;
    const wd = ctx.measureText(text).width;
    const padX = 7, padY = 5;
    const bw = wd + padX * 2, bh = size + padY * 2;
    const bx = align === "right" ? x - bw : x;
    const by = y - bh / 2;
    ctx.fillStyle = "rgba(11,12,13,0.92)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 6);
    else ctx.rect(bx, by, bw, bh);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(text, bx + padX, by + bh - padY - 1);
    ctx.restore();
    return bw;
  }

  /* Δθ 눈금 변환 (로그).
     왼쪽 끝 = 가장 작은 각, 오른쪽 끝 = 가장 큰 각 — 슬라이더의 통상적인 방향을 따른다. */
  function dthFromSlider(idx) {
    const t = clamp(idx, 0, DTH_STEPS) / DTH_STEPS;
    return DTH_MIN * Math.pow(DTH_MAX / DTH_MIN, t);
  }
  function sliderFromDth(deg) {
    const t = Math.log(clamp(deg, DTH_MIN, DTH_MAX) / DTH_MIN) / Math.log(DTH_MAX / DTH_MIN);
    return Math.round(t * DTH_STEPS);
  }

  /** 각도를 크기에 맞춰 자릿수를 늘려 표시한다 */
  function fmtDeg(d) {
    if (d >= 10) return d.toFixed(1);
    if (d >= 1) return d.toFixed(2);
    if (d >= 0.1) return d.toFixed(3);
    if (d >= 0.01) return d.toFixed(4);
    return d.toFixed(5);
  }
  function fmtQty(x) {
    const a = Math.abs(x);
    if (a >= 1) return x.toFixed(4);
    if (a >= 0.01) return x.toFixed(5);
    return x.toFixed(7);
  }

  /* ---------------------------------------------------------
     r · T · v 연동
     v = 2πr/T 이므로 독립 변수는 둘뿐이다.
     r은 항상 독립, T와 v 중 마지막에 움직인 쪽(driver)이 기준이 된다.
     --------------------------------------------------------- */
  function syncFromDriver() {
    if (state.driver === "T") {
      state.T = clamp(state.T, T_MIN, T_MAX);
      let v = (TAU * state.r) / state.T;
      if (v > V_MAX) { v = V_MAX; state.T = (TAU * state.r) / v; }
      if (v < V_MIN) { v = V_MIN; state.T = (TAU * state.r) / v; }
      state.T = clamp(state.T, T_MIN, T_MAX);
      state.v = (TAU * state.r) / state.T;
    } else {
      state.v = clamp(state.v, V_MIN, V_MAX);
      let T = (TAU * state.r) / state.v;
      if (T > T_MAX) { T = T_MAX; state.v = (TAU * state.r) / T; }
      if (T < T_MIN) { T = T_MIN; state.v = (TAU * state.r) / T; }
      state.v = clamp(state.v, V_MIN, V_MAX);
      state.T = (TAU * state.r) / state.v;
    }
    state.omega = TAU / state.T;
    syncSecond();
  }

  /* 물체 B — A와의 관계(linkMode)에 따라 값이 정해진다.
     "omega" / "speed" 에서는 T₂·v₂가 A로부터 유도되므로 슬라이더 범위를 넘을 수 있다.
     이때 값을 잘라내면 ω(또는 v)가 같다는 전제 자체가 깨지므로 자르지 않는다. */
  function syncSecond() {
    if (state.linkMode === "omega") {
      state.T2 = state.T;
      state.omega2 = state.omega;
      state.v2 = state.r2 * state.omega2;
    } else if (state.linkMode === "speed") {
      state.v2 = state.v;
      state.omega2 = state.v2 / state.r2;
      state.T2 = TAU / state.omega2;
    } else {
      if (state.driver2 === "T") {
        state.T2 = clamp(state.T2, T_MIN, T_MAX);
        let v = (TAU * state.r2) / state.T2;
        if (v > V_MAX) { v = V_MAX; state.T2 = (TAU * state.r2) / v; }
        if (v < V_MIN) { v = V_MIN; state.T2 = (TAU * state.r2) / v; }
        state.T2 = clamp(state.T2, T_MIN, T_MAX);
        state.v2 = (TAU * state.r2) / state.T2;
      } else {
        state.v2 = clamp(state.v2, V_MIN, V_MAX);
        let T = (TAU * state.r2) / state.v2;
        if (T > T_MAX) { T = T_MAX; state.v2 = (TAU * state.r2) / T; }
        if (T < T_MIN) { T = T_MIN; state.v2 = (TAU * state.r2) / T; }
        state.v2 = clamp(state.v2, V_MIN, V_MAX);
        state.T2 = (TAU * state.r2) / state.v2;
      }
      state.omega2 = TAU / state.T2;
    }
  }

  /* ---------------------------------------------------------
     그리드 — 이 페이지만 x/y 등비율이다.
     (원이 타원으로 보이면 개념 자체가 깨지므로
      다른 페이지의 독립 스케일 방식을 쓰지 않는다.)
     --------------------------------------------------------- */
  function drawSimGrid(ctx, w, h, halfSpan) {
    const pad = 16;
    const size = Math.min(w, h) - pad * 2;
    const scale = size / (2 * halfSpan);
    const cx = w / 2, cy = h / 2;
    const step = SimUtils.niceStep(halfSpan * 2, 8);

    ctx.save();
    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth = 1;

    const nx = Math.ceil((w / 2) / (step * scale));
    const ny = Math.ceil((h / 2) / (step * scale));

    for (let i = -nx; i <= nx; i++) {
      const gx = Math.round(cx + i * step * scale) + 0.5;
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let i = -ny; i <= ny; i++) {
      const gy = Math.round(cy - i * step * scale) + 0.5;
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }

    ctx.strokeStyle = COLOR_AXIS;
    ctx.beginPath(); ctx.moveTo(0, Math.round(cy) + 0.5); ctx.lineTo(w, Math.round(cy) + 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(Math.round(cx) + 0.5, 0); ctx.lineTo(Math.round(cx) + 0.5, h); ctx.stroke();

    ctx.fillStyle = COLOR_LABEL;
    ctx.font = "10px 'JetBrains Mono', monospace";
    for (let i = -nx; i <= nx; i++) {
      if (i === 0) continue;
      const val = i * step;
      if (Math.abs(val) > halfSpan) continue;
      ctx.fillText(fmt(val, 1), cx + val * scale + 3, cy + 13);
    }
    label(ctx, "m", cx + 4, 14, COLOR_LABEL, 10);
    ctx.restore();

    return {
      toPx: (x, y) => ({ px: cx + x * scale, py: cy - y * scale }),
      scale, cx, cy,
    };
  }

  /** 궤도 원 그리기 */
  function drawOrbit(ctx, g, rad, color, alpha, dashed) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    if (dashed) ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, rad * g.scale, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawCenter(ctx, g) {
    ctx.save();
    ctx.fillStyle = COLOR_GEOM;
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, 3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawBall(ctx, g, p, color, rad = 6) {
    const { px, py } = g.toPx(p.x, p.y);
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, TAU);
    ctx.fill();
    ctx.restore();
    return { px, py };
  }

  /** 속도 벡터를 그릴 때 쓰는 픽셀/(m/s) 환산 계수 — 속력에 대해 완전히 선형이다 */
  function pxPerVel(g) {
    return (V_ARROW_FRAC * state.r * g.scale) / V_MAX;
  }

  /* 가속도·힘 화살표는 A와 B가 서로 비교되어야 하므로 같은 기준으로 길이를 정한다 */
  function accLen(g, a) {
    const base = state.r * g.scale;
    return clamp(0.5 * base * (a / A_REF), 14, base * 1.15);
  }
  function forceLen(g, f) {
    const base = state.r * g.scale;
    return clamp(0.45 * base * (f / F_REF), 16, base * 1.1);
  }

  /** 물체 B를 그린다 (2·3단계 공용) — 궤도 · 반지름선 · 물체 · 중심 방향 화살표 */
  function drawSecond(ctx, g, arrowLen, tag) {
    if (!state.showSecond) return;
    drawOrbit(ctx, g, state.r2, COLOR_SECOND, 0.34, true);

    const pB = posAt(state.theta2, state.r2);
    const qB = g.toPx(pB.x, pB.y);
    const RB = state.r2 * g.scale || 1;

    ctx.save();
    ctx.strokeStyle = COLOR_SECOND;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(g.cx, g.cy); ctx.lineTo(qB.px, qB.py); ctx.stroke();
    ctx.restore();

    const ux = (g.cx - qB.px) / RB;
    const uy = (g.cy - qB.py) / RB;
    arrowPx(ctx, qB.px, qB.py, qB.px + ux * arrowLen, qB.py + uy * arrowLen, COLOR_SECOND, 2.4);
    label(ctx, tag, qB.px + ux * arrowLen * 0.6 + 7, qB.py + uy * arrowLen * 0.6 + 4, COLOR_SECOND, 11);

    drawBall(ctx, g, pB, COLOR_SECOND, 5);
    label(ctx, "B", qB.px + 9, qB.py + 15, COLOR_SECOND, 10);
  }

  /* ---------------------------------------------------------
     1단계 — 각속도
     --------------------------------------------------------- */
  /* 두 물체를 같은 Δt로 재야 "같은 시간 동안 회전한 각"을 비교할 수 있다.
     그래서 B가 켜져 있으면 B의 주기까지 함께 고려해 창을 정한다. */
  function markWindow() {
    let dt = Math.min(MARK_DT, state.T * 0.75);
    if (state.showSecond) dt = Math.min(dt, state.T2 * 0.75);
    return dt;
  }

  function renderStep1(ctx, g) {
    drawOrbit(ctx, g, state.r, COLOR_GEOM, 0.42);
    if (state.showSecond) drawOrbit(ctx, g, state.r2, COLOR_SECOND, 0.42);
    drawCenter(ctx, g);

    const dt = markWindow();
    const thObj = state.theta;                        // 지금 물체가 있는 각
    const thAhead = state.theta + state.omega * dt;   // Δt 뒤에 도달할 각
    const R = state.r * g.scale;

    // 앞으로 Δt 동안 쓸고 지나갈 각을 부채꼴로
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(g.cx, g.cy);
    ctx.arc(g.cx, g.cy, R, -thObj, -thAhead, true);
    ctx.closePath();
    ctx.fillStyle = COLOR_DV;
    ctx.globalAlpha = 0.16;
    ctx.fill();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = COLOR_DV;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // 반지름
    const pA = posAt(thObj, state.r);
    const pxA = g.toPx(pA.x, pA.y);
    ctx.save();
    ctx.strokeStyle = COLOR_GEOM;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(g.cx, g.cy); ctx.lineTo(pxA.px, pxA.py); ctx.stroke();
    ctx.restore();

    const midTh = (thObj + thAhead) / 2;
    const lp = g.toPx(0.42 * state.r * Math.cos(midTh), 0.42 * state.r * Math.sin(midTh));
    label(ctx, "Δθ", lp.px - 9, lp.py + 4, COLOR_ACC, 12);

    const rp = g.toPx(0.55 * state.r * Math.cos(thObj), 0.55 * state.r * Math.sin(thObj));
    label(ctx, "r", rp.px + 6, rp.py - 4, COLOR_GEOM, 11);

    // 물체 B — linkMode에 따라 각속도가 A와 다를 수 있으므로 각도를 따로 누적한다
    if (state.showSecond) {
      const thB = state.theta2;
      const thBAhead = state.theta2 + state.omega2 * dt;
      const RB = state.r2 * g.scale;

      // B가 같은 Δt 동안 쓸고 지나갈 각
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(g.cx, g.cy);
      ctx.arc(g.cx, g.cy, RB, -thB, -thBAhead, true);
      ctx.closePath();
      ctx.fillStyle = COLOR_SECOND;
      ctx.globalAlpha = 0.2;
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = COLOR_SECOND;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      const midB = (thB + thBAhead) / 2;
      const lpB = g.toPx(0.55 * state.r2 * Math.cos(midB), 0.55 * state.r2 * Math.sin(midB));
      label(ctx, "Δθ₂", lpB.px - 11, lpB.py + 4, COLOR_SECOND, 11);

      const pB = posAt(state.theta2, state.r2);
      const pxB = g.toPx(pB.x, pB.y);
      ctx.save();
      ctx.strokeStyle = COLOR_SECOND;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(g.cx, g.cy); ctx.lineTo(pxB.px, pxB.py); ctx.stroke();
      ctx.restore();

      const k = pxPerVel(g);
      const dirB = velAt(state.theta2, 1);
      // v₂가 A의 상한을 넘을 수 있으므로 그려지는 길이만 제한한다 (표의 값은 그대로 정확하다)
      const capB = state.r * g.scale * 1.25;
      const lenB = Math.min(state.v2 * k, capB);
      arrowPx(ctx, pxB.px, pxB.py, pxB.px + dirB.x * lenB, pxB.py - dirB.y * lenB, COLOR_SECOND, 2);
      drawBall(ctx, g, pB, COLOR_SECOND, 5);
      label(ctx, "B", pxB.px + 8, pxB.py + 14, COLOR_SECOND, 10);
    }

    // 물체 A와 속도 벡터
    const k = pxPerVel(g);
    const dirA = velAt(thObj, 1);
    arrowPx(ctx, pxA.px, pxA.py, pxA.px + dirA.x * state.v * k, pxA.py - dirA.y * state.v * k, COLOR_V, 2.2);
    drawBall(ctx, g, pA, COLOR_V, 6);
    const vtip = { px: pxA.px + dirA.x * state.v * k, py: pxA.py - dirA.y * state.v * k };
    label(ctx, "v", vtip.px + 6, vtip.py - 4, COLOR_V, 12);
    if (state.showSecond) label(ctx, "A", pxA.px + 9, pxA.py + 15, COLOR_V, 10);
  }

  /* ---------------------------------------------------------
     2단계 — 구심 가속도
     --------------------------------------------------------- */
  function step2Vectors() {
    const dth = SimUtils.toRad(state.dthetaDeg);
    const th1 = state.theta;
    const th2 = th1 + dth;
    const v1 = velAt(th1, state.v);
    const v2 = velAt(th2, state.v);
    const dv = { x: v2.x - v1.x, y: v2.y - v1.y };
    const dvMag = Math.hypot(dv.x, dv.y);
    const inward = { x: -Math.cos(th1), y: -Math.sin(th1) };
    let angle = 0;
    if (dvMag > 1e-12) {
      const dot = (dv.x * inward.x + dv.y * inward.y) / dvMag;
      angle = Math.acos(clamp(dot, -1, 1));
    }
    return { dth, th1, th2, v1, v2, dv, dvMag, inward, angle };
  }

  function renderStep2(ctx, g) {
    const S = step2Vectors();
    const R = state.r * g.scale;

    drawOrbit(ctx, g, state.r, COLOR_GEOM, 0.42);
    drawSecond(ctx, g, accLen(g, (state.v2 * state.v2) / state.r2), "a");
    drawCenter(ctx, g);

    // Δθ 부채꼴
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(g.cx, g.cy);
    ctx.arc(g.cx, g.cy, R, -S.th1, -S.th2, true);
    ctx.closePath();
    ctx.fillStyle = COLOR_DV;
    ctx.globalAlpha = 0.1;
    ctx.fill();
    ctx.restore();

    const p1 = posAt(S.th1, state.r);
    const p2 = posAt(S.th2, state.r);
    const q1 = g.toPx(p1.x, p1.y);
    const q2 = g.toPx(p2.x, p2.y);

    ctx.save();
    ctx.strokeStyle = COLOR_GEOM;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(g.cx, g.cy); ctx.lineTo(q1.px, q1.py); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(g.cx, g.cy); ctx.lineTo(q2.px, q2.py); ctx.stroke();
    ctx.restore();

    const k = pxPerVel(g);

    // 나중 위치의 속도 v₂ (흐리게)
    ctx.save();
    ctx.globalAlpha = 0.5;
    arrowPx(ctx, q2.px, q2.py, q2.px + S.v2.x * k, q2.py - S.v2.y * k, COLOR_V, 1.8);
    ctx.restore();
    drawBall(ctx, g, p2, COLOR_GHOST, 5);
    label(ctx, "v₂", q2.px + S.v2.x * k + 5, q2.py - S.v2.y * k - 3, COLOR_V, 11);

    // 중심 방향(정확한 a의 방향) — 점선으로 기준선
    ctx.save();
    ctx.strokeStyle = COLOR_ACC;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(q1.px, q1.py); ctx.lineTo(g.cx, g.cy); ctx.stroke();
    ctx.restore();

    // a — 항상 정확히 중심 방향 (B와 크기를 견줄 수 있도록 길이를 크기에 비례시킨다)
    const aLen = Math.min(accLen(g, (state.v * state.v) / state.r), R * 1.05);
    const inwardPx = { x: (g.cx - q1.px), y: (g.cy - q1.py) };
    const inwardNorm = Math.hypot(inwardPx.x, inwardPx.y) || 1;
    arrowPx(
      ctx, q1.px, q1.py,
      q1.px + (inwardPx.x / inwardNorm) * aLen,
      q1.py + (inwardPx.y / inwardNorm) * aLen,
      COLOR_ACC, 1.8
    );
    label(
      ctx, "a",
      q1.px + (inwardPx.x / inwardNorm) * aLen * 0.55 + 7,
      q1.py + (inwardPx.y / inwardNorm) * aLen * 0.55 + 4,
      COLOR_ACC, 12
    );

    // Δv — 실제로 뺄셈해서 얻은 벡터. Δθ가 클수록 a에서 벌어진다.
    arrowPx(ctx, q1.px, q1.py, q1.px + S.dv.x * k, q1.py - S.dv.y * k, COLOR_DV, 2.6);
    label(ctx, "Δv", q1.px + S.dv.x * k + 6, q1.py - S.dv.y * k + 4, COLOR_DV, 12);

    // 현재 위치의 속도 v₁
    arrowPx(ctx, q1.px, q1.py, q1.px + S.v1.x * k, q1.py - S.v1.y * k, COLOR_V, 2.2);
    label(ctx, "v₁", q1.px + S.v1.x * k + 5, q1.py - S.v1.y * k - 3, COLOR_V, 11);

    drawBall(ctx, g, p1, COLOR_V, 6);
  }

  /** 2단계 오른쪽 패널의 벡터 삼각형 (v₂ − v₁ 작도) */
  function renderVec() {
    if (!vecCanvas || state.step !== 2) return;
    const fit = SimUtils.fitCanvas(vecCanvas);
    const { w, h, ctx } = fit;
    ctx.fillStyle = COLOR_SUNKEN;
    ctx.fillRect(0, 0, w, h);

    const S = step2Vectors();
    const v = state.v;

    const xs = [0, S.v1.x, S.v2.x];
    const ys = [0, S.v1.y, S.v2.y];
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const bw = Math.max(maxX - minX, v * 0.75);
    const bh = Math.max(maxY - minY, v * 0.75);

    const pad = 34;
    const s = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
    lastVecScale = s;   // 돋보기가 "몇 배 확대인지" 계산할 기준
    const ox = w / 2 - ((minX + maxX) / 2) * s;
    const oy = h / 2 + ((minY + maxY) / 2) * s;
    const P = (p) => ({ px: ox + p.x * s, py: oy - p.y * s });

    const O = P({ x: 0, y: 0 });
    const A = P(S.v1);
    const B = P(S.v2);

    // v₁, v₂ (같은 시작점에서)
    ctx.save();
    ctx.globalAlpha = 0.55;
    arrowPx(ctx, O.px, O.py, B.px, B.py, COLOR_V, 1.8);
    ctx.restore();
    arrowPx(ctx, O.px, O.py, A.px, A.py, COLOR_V, 2.2);

    // Δv — v₁의 끝에서 v₂의 끝으로
    arrowPx(ctx, A.px, A.py, B.px, B.py, COLOR_DV, 2.8);

    ctx.save();
    ctx.fillStyle = COLOR_GEOM;
    ctx.beginPath();
    ctx.arc(O.px, O.py, 2.5, 0, TAU);
    ctx.fill();
    ctx.restore();

    label(ctx, "v₁", A.px + 6, A.py + 4, COLOR_V, 12);
    label(ctx, "v₂", B.px + 6, B.py + 4, "#b8bcc4", 12);
    label(ctx, "Δv", (A.px + B.px) / 2 + 8, (A.py + B.py) / 2 + 4, COLOR_DV, 12);
    label(ctx, `Δθ = ${state.dthetaDeg}°`, 10, 16, COLOR_LABEL, 10);
    label(ctx, "Δv = v₂ − v₁", 10, h - 10, COLOR_LABEL, 10);
  }

  /* ---------------------------------------------------------
     전체 화면 · 구심 가속도의 유도

     교과서 p.24의 유도는 구조가 똑같은 두 줄이다.
       v = Δs/Δt = r·Δθ/Δt = rω     ← 위치 공간
       a = Δv/Δt = v·Δθ/Δt = vω     ← 속도 공간
     r 자리에 v가, Δs 자리에 Δv가 들어갈 뿐이다.
     실제로 두 그림은 반지름만 다른 닮은 부채꼴이므로,
     같은 함수로 두 번 그려서 "같은 그림"임을 눈으로 보이게 한다.

     (속도 공간의 원 = 속도 벡터의 끝이 그리는 원. 반지름이 v다.)
     --------------------------------------------------------- */
  let lastVecScale = 0;

  /** 반지름만 다른 닮은 부채꼴을 그린다. 두 캔버스가 같은 그림이 되도록 정규화한다.
      색이 곧 역할이다 — 흰 화살표 = 벡터(r 또는 v₁·v₂),
      밝은 라벤더 = 호, 진한 라벤더 = 현(변위 또는 Δv). */
  function drawSectorFigure(ctx, w, h, opts) {
    const dth = SimUtils.toRad(state.dthetaDeg);
    const hh = dth / 2;
    const pad = 34;
    const rot = opts.rotation || 0;   // 부채꼴 이등분선의 방향

    // 회전을 고려해 도형이 캔버스에 꽉 차도록 반지름과 중심을 정한다
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    const SAMPLES = 24;
    for (let i = 0; i <= SAMPLES; i++) {
      const a = rot - hh + (dth * i) / SAMPLES;
      const ux = Math.cos(a), uy = -Math.sin(a);
      if (ux < minX) minX = ux; if (ux > maxX) maxX = ux;
      if (uy < minY) minY = uy; if (uy > maxY) maxY = uy;
    }
    const bw = Math.max(maxX - minX, 1e-6);
    const bh = Math.max(maxY - minY, 1e-6);
    const R = Math.max(20, Math.min((w - pad * 2) / bw, (h - pad * 2) / bh));
    const cx = w / 2 - ((minX + maxX) / 2) * R;
    const cy = h / 2 - ((minY + maxY) / 2) * R;

    const P = (ang) => ({ px: cx + R * Math.cos(rot + ang), py: cy - R * Math.sin(rot + ang) });
    const p1 = P(-hh), p2 = P(hh), pm = P(0);

    // 전체 원 (희미하게) — 위치 공간은 궤도, 속도 공간은 속도 벡터 끝의 자취
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = COLOR_GEOM;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.restore();

    // 부채꼴
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, -(rot - hh), -(rot + hh), true);
    ctx.closePath();
    ctx.fillStyle = COLOR_DV;
    ctx.globalAlpha = 0.12;
    ctx.fill();
    ctx.restore();

    // Δθ 표시 (벡터 아래에 깔리도록 먼저)
    ctx.save();
    ctx.strokeStyle = COLOR_GEOM;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.22, -(rot - hh), -(rot + hh), true); ctx.stroke();
    ctx.restore();
    const dLab = P(0);
    label(ctx, "Δθ",
      cx + (dLab.px - cx) * 0.28 + 8,
      cy + (dLab.py - cy) * 0.28 + 4, COLOR_GEOM, 12);

    // 반지름 — 위치 공간은 회색 r, 속도 공간은 흰색 v₁·v₂
    const radiusColor = opts.radiusIsVector ? COLOR_V : COLOR_GEOM;
    arrowPx(ctx, cx, cy, p2.px, p2.py, radiusColor, 2.4);
    arrowPx(ctx, cx, cy, p1.px, p1.py, radiusColor, 2.4);
    chip(ctx, opts.vecLabel2, cx + (p2.px - cx) * 0.5, cy + (p2.py - cy) * 0.5 - 18, radiusColor, 12, "left");
    chip(ctx, opts.vecLabel1, cx + (p1.px - cx) * 0.5, cy + (p1.py - cy) * 0.5 + 18, radiusColor, 12, "left");

    // 호 — 밝은 라벤더
    ctx.save();
    ctx.strokeStyle = COLOR_ACC;
    ctx.lineWidth = 3.4;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(cx, cy, R, -(rot - hh), -(rot + hh), true); ctx.stroke();
    ctx.restore();

    // 현 — 진한 라벤더 화살표
    arrowPx(ctx, p1.px, p1.py, p2.px, p2.py, COLOR_DV, 3.2);

    // 위치 공간에서는 각 점의 속도(접선)를 함께 보여 v ⊥ r 을 드러낸다
    if (opts.showTangents) {
      const tLen = Math.min(R * 0.34, 108);
      [[p1, -hh, opts.tanLabel1], [p2, hh, opts.tanLabel2]].forEach(([p, a, txt]) => {
        const t = rot + a + Math.PI / 2;                 // 접선 방향 (반시계 회전)
        const tx = p.px + Math.cos(t) * tLen;
        const ty = p.py - Math.sin(t) * tLen;
        arrowPx(ctx, p.px, p.py, tx, ty, COLOR_V, 2.4);
        // 직각 표시
        const ux = Math.cos(rot + a), uy = -Math.sin(rot + a);       // 바깥 반지름 방향
        const vx = Math.cos(t), vy = -Math.sin(t);                   // 접선 방향
        const s = 11;
        ctx.save();
        ctx.strokeStyle = COLOR_V;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.px - ux * s, p.py - uy * s);
        ctx.lineTo(p.px - ux * s + vx * s, p.py - uy * s + vy * s);
        ctx.lineTo(p.px + vx * s, p.py + vy * s);
        ctx.stroke();
        ctx.restore();
        label(ctx, txt, tx + 7, ty + 4, COLOR_V, 12);
      });
    }

    ctx.save();
    ctx.fillStyle = opts.radiusIsVector ? COLOR_V : COLOR_ACC;
    ctx.beginPath(); ctx.arc(p1.px, p1.py, 4.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(p2.px, p2.py, 4.5, 0, TAU); ctx.fill();
    ctx.fillStyle = COLOR_GEOM;
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, TAU); ctx.fill();
    ctx.restore();

    if (opts.pointLabel1) {
      label(ctx, opts.pointLabel1, p1.px + 9, p1.py + 16, COLOR_ACC, 11);
      label(ctx, opts.pointLabel2, p2.px + 9, p2.py - 8, COLOR_ACC, 11);
    }

    // 돋보기 — 현이 너무 짧아지면 호/현 부분을 확대해 함께 보여준다
    const chordPx = Math.hypot(p2.px - p1.px, p2.py - p1.py);
    const lw = Math.min(168, w * 0.44);
    const lh = Math.min(130, h * 0.42);
    // 현이 아무리 짧아도 제대로 된 배율이 나와야 한다.
    // (예전에는 0.5px 아래를 예외 처리해서, 정작 돋보기가 필요한 구간에서 배율이 죽었다.)
    const lensScale = (LENS_FILL * lh) / Math.max(chordPx, 1e-9);

    if (lensScale >= LENS_MIN) {
      // 호에서 먼 쪽 구석에 놓아 그림을 가리지 않게 한다
      const lx = pm.px > w / 2 ? 10 : w - lw - 10;
      const ly = pm.py > h / 2 ? 10 : h - lh - 10;
      const lcx = lx + lw / 2, lcy = ly + lh / 2;
      const focus = { px: (pm.px + (p1.px + p2.px) / 2) / 2, py: (pm.py + (p1.py + p2.py) / 2) / 2 };
      const M = (q) => ({
        px: lcx + (q.px - focus.px) * lensScale,
        py: lcy + (q.py - focus.py) * lensScale,
      });

      // 안내선
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = COLOR_GEOM;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(focus.px, focus.py); ctx.lineTo(lx, ly + lh); ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.rect(lx, ly, lw, lh);
      ctx.fillStyle = "#101114";
      ctx.fill();
      ctx.clip();

      // 반지름 조각
      ctx.strokeStyle = COLOR_GEOM;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.2;
      [[p1, -hh], [p2, hh]].forEach(([p]) => {
        const a = M(p);
        const dirx = (p.px - cx), diry = (p.py - cy);
        const n = Math.hypot(dirx, diry) || 1;
        ctx.beginPath();
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(a.px - (dirx / n) * lw, a.py - (diry / n) * lw);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // 호
      ctx.strokeStyle = COLOR_ACC;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      const N = 48;
      for (let i = 0; i <= N; i++) {
        const a = -hh + (dth * i) / N;
        const q = M(P(a));
        if (i === 0) ctx.moveTo(q.px, q.py); else ctx.lineTo(q.px, q.py);
      }
      ctx.stroke();

      // 현 (= Δv)
      const m1 = M(p1), m2 = M(p2);
      arrowPx(ctx, m1.px, m1.py, m2.px, m2.py, COLOR_DV, 3.2);
      ctx.fillStyle = COLOR_V;
      ctx.beginPath(); ctx.arc(m1.px, m1.py, 4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(m2.px, m2.py, 4, 0, TAU); ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = COLOR_HAIRLINE;
      ctx.lineWidth = 1;
      ctx.strokeRect(lx + 0.5, ly + 0.5, lw - 1, lh - 1);
      ctx.restore();
      label(ctx, "돋보기", lx + 8, ly + 15, COLOR_LABEL, 10);
      labelRight(
        ctx,
        `×${lensScale < 10 ? lensScale.toFixed(1) : Math.round(lensScale)}`,
        lx + lw - 8, ly + 15, COLOR_LABEL, 10
      );
      label(ctx, opts.arcShort, lx + 8, ly + lh - 22, COLOR_ACC, 11);
      label(ctx, opts.chordShort, lx + 8, lh > 0 ? ly + lh - 8 : ly, COLOR_DV, 11);
    }

    // 호 · 현 라벨 — 부채꼴이 회전해도 서로 반대쪽에 붙도록 방향을 따라 배치한다
    const ux = (pm.px - cx) / R, uy = (pm.py - cy) / R;   // 바깥 방향
    const nx = uy, ny = -ux;                              // 그에 수직
    const off = Math.max(chordPx / 2, 12) + 20;
    labelRight(ctx, opts.arcLabel,
      pm.px + ux * 8 + nx * off, pm.py + uy * 8 + ny * off + 4, COLOR_ACC, 12);
    chip(ctx, opts.chordLabel,
      pm.px - ux * 10 - nx * off, pm.py - uy * 10 - ny * off, COLOR_DV, 12, "right");

    return { cx, cy, R, p1, p2, pm, hh, chordPx };
  }

  function renderDerive() {
    if (!state.deriveOpen) return;

    const dth = SimUtils.toRad(state.dthetaDeg);
    const hh = dth / 2;

    if (posCanvas) {
      const { w, h, ctx } = SimUtils.fitCanvas(posCanvas);
      ctx.fillStyle = COLOR_SUNKEN;
      ctx.fillRect(0, 0, w, h);
      drawSectorFigure(ctx, w, h, {
        rotation: 0,
        radiusIsVector: false,
        vecLabel1: "r",
        vecLabel2: "r",
        pointLabel1: "P₁",
        pointLabel2: "P₂",
        showTangents: true,
        tanLabel1: "v₁",
        tanLabel2: "v₂",
        arcLabel: "호 Δs = r·Δθ",
        chordLabel: "곧은 거리 (현)",
        arcShort: "호",
        chordShort: "현",
      });
    }

    if (velCanvas) {
      const { w, h, ctx } = SimUtils.fitCanvas(velCanvas);
      ctx.fillStyle = COLOR_SUNKEN;
      ctx.fillRect(0, 0, w, h);
      // 실제로는 v ⊥ r 이므로 속도 부채꼴은 위치 부채꼴을 90° 돌린 것이다.
      // 토글을 켜면 90° 되돌려 두 그림을 겹쳐 볼 수 있다.
      drawSectorFigure(ctx, w, h, {
        rotation: (Math.PI / 2) * (1 - state.velAlign),
        radiusIsVector: true,
        vecLabel1: "v₁",
        vecLabel2: "v₂",
        arcLabel: "호 = v·Δθ",
        chordLabel: "Δv = v₂ − v₁",
        arcShort: "호 vΔθ",
        chordShort: "Δv",
      });
    }

    // ③ 유도 패널
    const dt = dth / state.omega;
    const arc = state.r * dth;
    const chord = 2 * state.r * Math.sin(hh);
    const approx = state.v * dth;
    const dv = 2 * state.v * Math.sin(hh);
    const aTrue = (state.v * state.v) / state.r;

    const dtText = dt < 0.001 ? `${fmt(dt * 1000, 4)} ms` : `${fmt(dt, 4)} s`;
    $("deriveCond").textContent =
      `r = ${fmt(state.r, 2)} m   v = ${fmt(state.v, 2)} m/s   T = ${fmt(state.T, 2)} s   ω = ${fmt(state.omega, 3)} rad/s   Δt = ${dtText}`;

    $("dArc").textContent = `${fmtQty(arc)} m`;
    $("dChord").textContent = `${fmtQty(chord)} m`;
    // 비율이 사실상 1이면 학생이 바로 알아볼 수 있게 표시해 준다
    const ratioText = (x) =>
      `${fmt(x, 6)}${x >= 0.9999 ? "<i>거의 1</i>" : ""}`;

    $("dChordRatio").innerHTML = ratioText(arc > 0 ? chord / arc : 1);
    $("dApprox").textContent = `${fmtQty(approx)} m/s`;
    $("dDv").textContent = `${fmtQty(dv)} m/s`;
    $("dDvRatio").innerHTML = ratioText(approx > 0 ? dv / approx : 1);
    $("dV").textContent = `${fmt(state.v, 3)} m/s`;
    $("dAMeas").textContent = `${fmt(dv / dt, 4)} m/s²`;
    $("dATrue").textContent = `${fmt(aTrue, 4)} m/s²`;
    $("dAngle").textContent = `${fmtDeg((hh * 180) / Math.PI)}°`;
    $("dHalf").textContent = `${fmtDeg(state.dthetaDeg / 2)}°`;
  }

  /* ---------------------------------------------------------
     3단계 — 구심력
     --------------------------------------------------------- */
  function renderStep3(ctx, g) {
    const R = state.r * g.scale;
    drawOrbit(ctx, g, state.r, COLOR_GEOM, state.cut ? 0.22 : 0.42, state.cut);
    drawSecond(ctx, g, forceLen(g, (state.m2 * state.v2 * state.v2) / state.r2), "F");
    drawCenter(ctx, g);

    const k = pxPerVel(g);

    if (!state.cut) {
      const p = posAt(state.theta, state.r);
      const q = g.toPx(p.x, p.y);

      // 줄(장력)
      ctx.save();
      ctx.strokeStyle = COLOR_FORCE;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(g.cx, g.cy); ctx.lineTo(q.px, q.py); ctx.stroke();
      ctx.restore();

      // 구심력
      const F = (state.m * state.v * state.v) / state.r;
      const fLen = Math.min(forceLen(g, F), R * 1.05);
      const ux = (g.cx - q.px) / (R || 1);
      const uy = (g.cy - q.py) / (R || 1);
      arrowPx(ctx, q.px, q.py, q.px + ux * fLen, q.py + uy * fLen, COLOR_FORCE, 3);
      label(ctx, "F", q.px + ux * fLen * 0.6 + 8, q.py + uy * fLen * 0.6 + 4, COLOR_FORCE, 12);

      // 속도
      const vv = velAt(state.theta, state.v);
      arrowPx(ctx, q.px, q.py, q.px + vv.x * k, q.py - vv.y * k, COLOR_V, 2.2);
      label(ctx, "v", q.px + vv.x * k + 6, q.py - vv.y * k - 3, COLOR_V, 12);

      drawBall(ctx, g, p, COLOR_V, 6);
      return;
    }

    // 줄이 끊긴 뒤 — 알짜힘 0, 접선 방향 등속 직선 운동
    const p0 = state.cutPos;
    const now = {
      x: p0.x + state.cutVel.x * state.cutT,
      y: p0.y + state.cutVel.y * state.cutT,
    };
    const a0 = g.toPx(p0.x, p0.y);
    const a1 = g.toPx(now.x, now.y);

    ctx.save();
    ctx.strokeStyle = COLOR_V;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(a0.px, a0.py); ctx.lineTo(a1.px, a1.py); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = COLOR_GHOST;
    ctx.beginPath(); ctx.arc(a0.px, a0.py, 4, 0, TAU); ctx.fill();
    ctx.restore();
    label(ctx, "줄이 끊긴 지점", a0.px + 8, a0.py - 8, COLOR_LABEL, 10);

    arrowPx(ctx, a1.px, a1.py, a1.px + state.cutVel.x * k, a1.py - state.cutVel.y * k, COLOR_V, 2.2);
    label(ctx, "v", a1.px + state.cutVel.x * k + 6, a1.py - state.cutVel.y * k - 3, COLOR_V, 12);
    drawBall(ctx, g, now, COLOR_V, 6);
  }

  /* ---------------------------------------------------------
     화면 갱신
     --------------------------------------------------------- */
  /* 드래그 중에는 시야 범위를 고정한다.
     r을 끌 때 시야가 같이 변하면 (반지름↑ → 축척↓ → 반지름↑) 되먹임이 생겨
     점이 손을 벗어나 최대/최소로 튀어 버린다. */
  let frozenSpan = null;

  function viewSpan() {
    if (frozenSpan != null) return frozenSpan;
    let rmax = state.r;
    if (state.showSecond) rmax = Math.max(rmax, state.r2);
    return Math.max(0.8, rmax * 1.45);
  }

  function render() {
    const fit = SimUtils.fitCanvas(canvas);
    const { w, h, ctx } = fit;
    ctx.fillStyle = COLOR_STAGE;
    ctx.fillRect(0, 0, w, h);

    const g = drawSimGrid(ctx, w, h, viewSpan());
    lastG = g;

    if (state.step === 1) renderStep1(ctx, g);
    else if (state.step === 2) renderStep2(ctx, g);
    else renderStep3(ctx, g);

    renderVec();
    renderDerive();
    updateReadouts();
  }

  function updateReadouts() {
    if (state.step === 1) {
      const dt = markWindow();
      const dthRad = state.omega * dt;
      $("ro1dt").textContent = `${fmt(dt, 2)} s`;
      if (state.showSecond) {
        const dthB = state.omega2 * dt;
        $("ro1dthDeg").innerHTML =
          `${fmt((dthRad * 180) / Math.PI, 1)}°<span class="ro-b">${fmt((dthB * 180) / Math.PI, 1)}°</span>`;
        $("ro1dthRad").innerHTML =
          `${fmt(dthRad, 3)}<span class="ro-b">${fmt(dthB, 3)}</span>`;
      } else {
        $("ro1dthDeg").textContent = `${fmt((dthRad * 180) / Math.PI, 1)}°`;
        $("ro1dthRad").textContent = `${fmt(dthRad, 3)} rad`;
      }
      $("ro1omega").textContent = `${fmt(dthRad / dt, 3)} rad/s`;
      $("ro1omega2").textContent = `${fmt(TAU / state.T, 3)}`;
      $("ro1v").textContent = `${fmt(state.r * state.omega, 2)}`;

      if (state.showSecond) {
        const aA = (state.v * state.v) / state.r;
        const aB = (state.v2 * state.v2) / state.r2;
        $("cmpRa").textContent = fmt(state.r, 1);
        $("cmpVa").textContent = fmt(state.v, 2);
        $("cmpWa").textContent = fmt(state.omega, 2);
        $("cmpAa").textContent = fmt(aA, 2);
        $("cmpRb").textContent = fmt(state.r2, 1);
        $("cmpVb").textContent = fmt(state.v2, 2);
        $("cmpWb").textContent = fmt(state.omega2, 2);
        $("cmpAb").textContent = fmt(aB, 2);
      }
      return;
    }

    if (state.step === 2) {
      const S = step2Vectors();
      const dt = S.dth / state.omega;
      const approx = state.v * S.dth;
      const ratio = approx > 0 ? S.dvMag / approx : 1;
      $("ro2dt").textContent = `${fmt(dt, 3)} s`;
      $("ro2dv").textContent = `${fmt(S.dvMag, 3)} m/s`;
      $("ro2approx").textContent = `${fmt(approx, 3)} m/s`;
      $("ro2ratio").textContent = fmt(ratio, 4);
      $("ro2angle").textContent = `${fmt((S.angle * 180) / Math.PI, 2)}°`;
      $("ro2ameas").textContent = `${fmt(S.dvMag / dt, 3)} m/s²`;
      $("ro2atrue").textContent = `${fmt((state.v * state.v) / state.r, 3)} m/s²`;
      $("ro2bRow").classList.toggle("hidden", !state.showSecond);
      if (state.showSecond) {
        $("ro2ab").textContent = `${fmt((state.v2 * state.v2) / state.r2, 3)} m/s²`;
      }
      $("idA").textContent = fmt(state.v * state.omega, 3);
      $("idB").textContent = fmt(state.r * state.omega * state.omega, 3);
      $("idC").textContent = fmt((state.v * state.v) / state.r, 3);
      return;
    }

    const a = (state.v * state.v) / state.r;
    $("ro3m").textContent = `${fmt(state.m, 1)} kg`;
    $("ro3a").textContent = `${fmt(a, 2)} m/s²`;
    $("ro3f").textContent = `${fmt(state.m * a, 2)} N`;
    $("ro3dir").textContent = state.cut ? "없음 (알짜힘 0)" : "원의 중심";
    $("ro3bRow").classList.toggle("hidden", !state.showSecond);
    $("ro3bmRow").classList.toggle("hidden", !state.showSecond);
    if (state.showSecond) {
      $("ro3mb").textContent = `${fmt(state.m2, 1)} kg`;
      $("ro3fb").textContent = `${fmt((state.m2 * state.v2 * state.v2) / state.r2, 2)} N`;
    }
  }

  /* ---------------------------------------------------------
     캔버스 위에서 직접 끌어 조절하기
       물체 A  → 중심에서의 거리로 r
       화살표  → 접선 방향 투영 길이로 v (1·3단계)
       물체 B  → 중심에서의 거리로 r₂ (1단계)
     --------------------------------------------------------- */
  let lastG = null;   // 마지막으로 그린 좌표 변환 (히트 판정용)
  let drag = null;    // "rA" | "vA" | "rB"

  function canvasPos(e) {
    const b = canvas.getBoundingClientRect();
    return { mx: e.clientX - b.left, my: e.clientY - b.top };
  }

  function hitTest(mx, my) {
    const g = lastG;
    if (!g || state.cut) return null;

    const pA = posAt(state.theta, state.r);
    const qA = g.toPx(pA.x, pA.y);

    if (state.step === 1 || state.step === 3) {
      const k = pxPerVel(g);
      const vv = velAt(state.theta, state.v);
      const tx = qA.px + vv.x * k;
      const ty = qA.py - vv.y * k;
      // 화살표가 너무 짧아 물체와 겹칠 때는 물체 쪽에 우선권을 준다
      const longEnough = state.v * k > GRAB_BALL + 4;
      if (longEnough && Math.hypot(mx - tx, my - ty) <= GRAB_TIP) return "vA";
    }
    if (Math.hypot(mx - qA.px, my - qA.py) <= GRAB_BALL) return "rA";

    if (state.showSecond) {
      const pB = posAt(state.theta2, state.r2);
      const qB = g.toPx(pB.x, pB.y);
      if (Math.hypot(mx - qB.px, my - qB.py) <= GRAB_BALL) return "rB";
    }
    return null;
  }

  function applyDrag(mx, my) {
    const g = lastG;
    if (!g) return;

    // 슬라이더 눈금에 맞춰 반올림한다 (슬라이더 손잡이와 내부 값이 어긋나지 않도록)
    const snap = (x, stepSize) => Math.round(x / stepSize) * stepSize;

    if (drag === "rA" || drag === "rB") {
      const dist = Math.hypot(mx - g.cx, my - g.cy) / g.scale;
      if (drag === "rA") {
        state.r = clamp(snap(dist, 0.1), R_MIN, R_MAX);
        $("rInput").value = String(state.r);
        syncFromDriver();
      } else {
        state.r2 = clamp(snap(dist, 0.1), R2_MIN, R2_MAX);
        $("r2Input").value = String(state.r2);
        syncSecond();
      }
    } else if (drag === "vA") {
      const k = pxPerVel(g);
      const p = posAt(state.theta, state.r);
      const q = g.toPx(p.x, p.y);
      const dir = velAt(state.theta, 1);                  // 접선 단위벡터(월드)
      const proj = (mx - q.px) * dir.x + (my - q.py) * -dir.y;
      state.driver = "v";
      state.v = clamp(snap(proj / k, 0.05), V_MIN, V_MAX);
      $("vInput").value = String(state.v);
      syncFromDriver();
    }

    updateControls();
    updateStatus();
    render();
  }

  function bindDrag() {
    canvas.addEventListener("mousedown", (e) => {
      const { mx, my } = canvasPos(e);
      const hit = hitTest(mx, my);
      if (!hit) return;
      e.preventDefault();
      drag = hit;
      frozenSpan = viewSpan();
      state.running = false;
      updatePlayButtons();
      canvas.style.cursor = "grabbing";
      // 잡는 순간에는 값을 바꾸지 않는다 (클릭만 해도 값이 튀는 것을 막는다)
      render();
    });

    canvas.addEventListener("mousemove", (e) => {
      if (drag) return;
      const { mx, my } = canvasPos(e);
      canvas.style.cursor = hitTest(mx, my) ? "grab" : "default";
    });

    window.addEventListener("mousemove", (e) => {
      if (!drag) return;
      const { mx, my } = canvasPos(e);
      applyDrag(mx, my);
    });

    window.addEventListener("mouseup", () => {
      if (!drag) return;
      drag = null;
      frozenSpan = null;
      canvas.style.cursor = "grab";
      render();
    });
  }

  function updateStageHint() {
    const hint = $("stageHint");
    if (!hint) return;
    if (state.cut) hint.textContent = "";
    else if (state.step === 2) hint.textContent = "물체를 끌면 r";
    else hint.textContent = "물체를 끌면 r · 화살표 끝을 끌면 v";
  }

  /* ---------------------------------------------------------
     범례
     --------------------------------------------------------- */
  function updateLegend() {
    const line = (color, text) =>
      `<div><i style="background:${color}"></i>${text}</div>`;
    const dash = (color, text) =>
      `<div><i class="dash" style="color:${color}"></i>${text}</div>`;

    let html = "";
    if (state.step === 1) {
      html += line(COLOR_V, "v — 속도(접선 방향)");
      html += line(COLOR_DV, "Δθ — 앞으로 Δt 동안 회전할 각");
      if (state.showSecond) html += line(COLOR_SECOND, "물체 B 와 Δθ₂ (같은 Δt)");
    } else if (state.step === 2) {
      html += line(COLOR_V, "v₁, v₂ — 속도");
      html += line(COLOR_DV, "Δv = v₂ − v₁ (측정)");
      html += dash(COLOR_ACC, "a — 중심 방향 (극한)");
      if (state.showSecond) html += line(COLOR_SECOND, "물체 B 와 그 a");
    } else {
      html += line(COLOR_V, "v — 속도(접선 방향)");
      html += line(COLOR_FORCE, "F — 구심력(중심 방향)");
      if (state.showSecond) html += line(COLOR_SECOND, "물체 B 와 그 F");
      if (state.cut) html += dash(COLOR_V, "줄이 끊긴 뒤의 경로");
    }
    legend.innerHTML = html;
  }

  function updateStatus() {
    let text;
    if (state.cut) text = state.escaped ? "줄 끊김 — 등속 직선 운동" : "줄 끊김";
    else if (state.running) text = `회전 중 · T = ${fmt(state.T, 2)} s`;
    else text = "정지";
    statusTag.textContent = text;
    statusTag.classList.toggle("is-active", state.running);
  }

  /* ---------------------------------------------------------
     설정 컨트롤
     --------------------------------------------------------- */
  /** 입력 중인 칸은 건드리지 않는다 (타이핑을 덮어쓰지 않도록) */
  function setNum(id, val, digits) {
    const el = $(id);
    if (!el || document.activeElement === el) return;
    el.value = val.toFixed(digits);
  }

  function updateControls() {
    setNum("rValue", state.r, 1);
    setNum("tValue", state.T, 2);
    setNum("vValue", state.v, 2);
    setNum("mValue", state.m, 1);
    setNum("r2Value", state.r2, 1);
    setNum("t2Value", state.T2, 2);
    setNum("v2Value", state.v2, 2);
    setNum("m2Value", state.m2, 1);

    // 두 슬라이더 모두 실제 상태에서 되쓴다.
    // (입력한 값이 다른 쪽 한계에 걸려 잘렸을 때 손잡이가 엉뚱한 곳에 남지 않도록)
    $("rInput").value = String(state.r);
    $("tInput").value = String(state.T);
    $("vInput").value = String(state.v);
    $("mInput").value = String(state.m);
    $("r2Input").value = String(state.r2);
    $("m2Input").value = String(state.m2);

    const tDriving = state.driver === "T";
    $("tHint").textContent = tDriving ? "기준값" : "계산된 값";
    $("vHint").textContent = tDriving ? "계산된 값" : "기준값";
    $("tHint").classList.toggle("is-driver", tDriving);
    $("tHint").classList.toggle("is-derived", !tDriving);
    $("vHint").classList.toggle("is-driver", !tDriving);
    $("vHint").classList.toggle("is-derived", tDriving);
    $("tGroup").classList.toggle("is-derived", !tDriving);
    $("vGroup").classList.toggle("is-derived", tDriving);

    updateSecondControls();
  }

  const MODE_LABEL = { omega: "ω 같게", speed: "v 같게", free: "따로 설정" };

  function updateSecondControls() {
    const free = state.linkMode === "free";
    $("t2Group").classList.toggle("hidden", !free);
    $("v2Group").classList.toggle("hidden", !free);

    if (free) {
      const t2Driving = state.driver2 === "T";
      $("t2Input").value = String(state.T2);
      $("v2Input").value = String(state.v2);
      $("t2Hint").textContent = t2Driving ? "기준값" : "계산된 값";
      $("v2Hint").textContent = t2Driving ? "계산된 값" : "기준값";
      $("t2Hint").classList.toggle("is-driver", t2Driving);
      $("t2Hint").classList.toggle("is-derived", !t2Driving);
      $("v2Hint").classList.toggle("is-driver", !t2Driving);
      $("v2Hint").classList.toggle("is-derived", t2Driving);
      $("t2Group").classList.toggle("is-derived", !t2Driving);
      $("v2Group").classList.toggle("is-derived", t2Driving);
    }

    const note = $("secondDerived");
    if (note) {
      if (state.linkMode === "omega") {
        note.textContent =
          `ω₂ = ω = ${fmt(state.omega2, 3)} rad/s → v₂ = r₂ω = ${fmt(state.v2, 2)} m/s`;
      } else if (state.linkMode === "speed") {
        note.textContent =
          `v₂ = v = ${fmt(state.v2, 2)} m/s → ω₂ = v/r₂ = ${fmt(state.omega2, 3)} rad/s, T₂ = ${fmt(state.T2, 2)} s`;
      } else {
        note.textContent = `ω₂ = ${fmt(state.omega2, 3)} rad/s (A와 무관하게 설정된 상태)`;
      }
    }

    const modeTag = $("cmpMode");
    if (modeTag) modeTag.textContent = MODE_LABEL[state.linkMode];

    const cmpNote = $("cmpNote");
    if (cmpNote) {
      if (state.linkMode === "omega") {
        cmpNote.innerHTML =
          "ω가 같으므로 <code>v = rω</code>, <code>a = rω²</code> — 둘 다 <b>r에 비례</b>한다. " +
          "<b>반지름이 큰 쪽이 속력도 가속도도 크다.</b>";
      } else if (state.linkMode === "speed") {
        cmpNote.innerHTML =
          "v가 같으므로 <code>ω = v/r</code>, <code>a = v²/r</code> — 둘 다 <b>r에 반비례</b>한다. " +
          "<b>반지름이 작은 쪽이 가속도가 크다.</b> ω 같게와 결론이 정반대다.";
      } else {
        cmpNote.innerHTML =
          "두 물체를 독립적으로 설정한 상태다. 한쪽 값을 A와 맞춰 놓고 나머지가 어떻게 달라지는지 살펴보자.";
      }
    }
  }

  /* ---------------------------------------------------------
     단계 전환
     --------------------------------------------------------- */
  function setStep(n) {
    state.step = n;
    if (n !== 3) resetCut();
    document.querySelectorAll(".step-tab").forEach((b) => {
      b.classList.toggle("is-active", Number(b.dataset.step) === n);
    });
    document.querySelectorAll(".step-pane").forEach((p) => {
      p.classList.toggle("is-active", Number(p.dataset.pane) === n);
    });
    $("cmpBox").classList.toggle("hidden", !state.showSecond);
    $("note1").classList.toggle("hidden", state.showSecond);
    updateLegend();
    updateStageHint();
    updateStatus();
    render();
  }

  /* ---------------------------------------------------------
     줄 끊기
     --------------------------------------------------------- */
  function resetCut() {
    state.cut = false;
    state.escaped = false;
    state.cutPos = null;
    state.cutVel = null;
    state.cutT = 0;
    $("cutBtn").disabled = false;
    $("cutBtn").textContent = "줄 끊기";
    $("predictResult").classList.add("hidden");
  }

  function doCut() {
    state.cutPos = posAt(state.theta, state.r);
    state.cutVel = velAt(state.theta, state.v);
    state.cutT = 0;
    state.cut = true;
    state.escaped = false;
    state.running = true;
    $("cutBtn").disabled = true;
    $("cutBtn").textContent = "끊김 — 초기화로 되돌리기";
    showPredictResult();
    updateLegend();
    updateStageHint();
    updateStatus();
    updatePlayButtons();
    render();
  }

  function showPredictResult() {
    const box = $("predictResult");
    box.classList.remove("hidden");
    box.innerHTML =
      "구심력이 사라져 <b>알짜힘이 0</b>이 되었다. 관성에 의해 물체는 그 순간의 속도 방향, " +
      "즉 <b>접선 방향으로 등속 직선 운동</b>한다. 해머던지기에서 해머가 날아가는 방향이 이것이다." +
      "<br><span style=\"color:#62666d\">※ 수평면 위의 운동으로 본다. " +
      "연직면에서 돌리다 놓으면 중력 때문에 포물선을 그린다.</span>";
  }

  /* ---------------------------------------------------------
     Δθ 조작 — 본 화면과 전체 화면의 슬라이더를 함께 움직인다
     --------------------------------------------------------- */
  function setDtheta(deg) {
    state.dthetaDeg = clamp(deg, DTH_MIN, DTH_MAX);
    const text = `${fmtDeg(state.dthetaDeg)}°`;
    const idx = String(sliderFromDth(state.dthetaDeg));
    $("dthetaInput").value = idx;
    $("dthetaValue").textContent = text;
    $("dthetaFull").value = idx;
    $("dthetaFullValue").textContent = text;
    limitLabel();
    render();
  }

  /* ② 를 90° 돌려 ① 위에 포개거나 되돌린다 */
  let alignTimer = null;

  function toggleAlign() {
    if (alignTimer) clearInterval(alignTimer);
    const from = state.velAlign;
    const to = from > 0.5 ? 0 : 1;
    const t0 = performance.now();
    const DUR = 550;
    $("alignToggle").classList.toggle("is-on", to === 1);
    $("alignToggle").textContent = to === 1 ? "실제 방향으로" : "① 과 나란히 놓기";
    alignTimer = setInterval(() => {
      const t = Math.min(1, (performance.now() - t0) / DUR);
      const e = t * t * (3 - 2 * t);   // 부드럽게
      state.velAlign = from + (to - from) * e;
      render();
      if (t >= 1) { clearInterval(alignTimer); alignTimer = null; }
    }, 16);
  }

  function openDerive() {
    state.deriveOpen = true;
    state.running = false;          // 유도는 정지 상태에서 본다
    updatePlayButtons();
    updateStatus();
    $("deriveOverlay").classList.remove("hidden");
    setDtheta(state.dthetaDeg);
  }

  function closeDerive() {
    stopLimit();
    state.deriveOpen = false;
    $("deriveOverlay").classList.add("hidden");
    render();
  }

  /* 「극한으로」 — Δθ를 지수적으로 줄여 1°까지 보낸다.
     작은 각에서 천천히 줄어들도록 비율 감소를 쓴다. */
  let limitTimer = null;

  function limitLabel() {
    const btn = $("limitBtn");
    if (!btn) return;
    if (limitTimer) btn.textContent = "멈춤";
    else if (state.dthetaDeg <= DTH_MIN * 1.5) btn.textContent = "다시 60°로";
    else btn.textContent = "극한으로";
  }

  function stopLimit() {
    if (limitTimer) {
      clearInterval(limitTimer);
      limitTimer = null;
    }
    limitLabel();
  }

  function onLimitClick() {
    if (limitTimer) { stopLimit(); return; }
    if (state.dthetaDeg <= DTH_MIN * 1.5) { setDtheta(60); limitLabel(); return; }
    const start = state.dthetaDeg;
    const t0 = performance.now();
    limitTimer = setInterval(() => {
      const t = Math.min(1, (performance.now() - t0) / LIMIT_MS);
      // 로그 눈금에서 일정한 속도로 줄인다 (작은 각에서도 변화가 계속 보이도록)
      setDtheta(start * Math.pow(DTH_MIN / start, t));
      if (t >= 1) stopLimit();
    }, 16);
    limitLabel();
  }

  /* ---------------------------------------------------------
     애니메이션
     --------------------------------------------------------- */
  let lastTs = null;

  function updatePlayButtons() {
    $("playBtn").disabled = state.running;
    $("pauseBtn").disabled = !state.running;
  }

  function frame(ts) {
    if (state.running) {
      if (lastTs == null) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;

      // 물체 B는 A의 줄이 끊겨도 계속 돈다
      state.theta2 += state.omega2 * dt;
      if (state.theta2 > TAU) state.theta2 -= TAU;

      if (state.cut) {
        state.cutT += dt;
        const p = {
          x: state.cutPos.x + state.cutVel.x * state.cutT,
          y: state.cutPos.y + state.cutVel.y * state.cutT,
        };
        if (Math.hypot(p.x, p.y) > viewSpan() * 1.35) {
          state.running = false;
          state.escaped = true;
          updatePlayButtons();
          updateStatus();
        }
      } else {
        state.theta += state.omega * dt;
        if (state.theta > TAU) state.theta -= TAU;
      }
    } else {
      lastTs = ts;
    }

    render();
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------
     이벤트 연결
     --------------------------------------------------------- */
  function bind() {
    $("playBtn").addEventListener("click", () => {
      if (state.escaped) return;
      state.running = true;
      lastTs = null;
      updatePlayButtons();
      updateStatus();
    });

    $("pauseBtn").addEventListener("click", () => {
      state.running = false;
      updatePlayButtons();
      updateStatus();
    });

    $("resetBtn").addEventListener("click", () => {
      state.running = false;
      state.theta = 0;
      state.theta2 = 0;
      resetCut();
      updatePlayButtons();
      updateLegend();
      updateStageHint();
      updateStatus();
      render();
    });

    $("settingsToggle").addEventListener("click", () => $("settingsOverlay").classList.remove("hidden"));
    $("settingsClose").addEventListener("click", () => $("settingsOverlay").classList.add("hidden"));
    $("settingsBackdrop").addEventListener("click", () => $("settingsOverlay").classList.add("hidden"));
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (state.deriveOpen) closeDerive();
      else $("settingsOverlay").classList.add("hidden");
    });

    document.querySelectorAll(".step-tab").forEach((b) => {
      b.addEventListener("click", () => setStep(Number(b.dataset.step)));
    });

    // 슬라이더와 숫자 입력 칸을 한 쌍으로 묶는다
    const pairControl = (sliderId, numId, digits, set) => {
      const slider = $(sliderId);
      const num = $(numId);
      const lo = Number(slider.min), hi = Number(slider.max);
      const apply = (raw, fromNum) => {
        const parsed = Number(raw);
        if (!isFinite(parsed)) { updateControls(); return; }
        const val = clamp(parsed, lo, hi);
        set(val);
        // 슬라이더 위치와 숫자 칸은 updateControls()가 실제 상태에서 다시 채운다.
        // 여기서는 입력 칸의 포커스만 풀어 그 갱신이 반영되게 한다.
        if (fromNum) num.blur();
        updateControls();
        updateStatus();
        render();
      };
      slider.addEventListener("input", (e) => apply(e.target.value, false));
      num.addEventListener("change", (e) => apply(e.target.value, true));
      num.addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
    };

    pairControl("rInput", "rValue", 1, (val) => {
      state.r = val;
      syncFromDriver();
      resetCut();
    });
    pairControl("tInput", "tValue", 2, (val) => {
      state.driver = "T";
      state.T = val;
      syncFromDriver();
    });
    pairControl("vInput", "vValue", 2, (val) => {
      state.driver = "v";
      state.v = val;
      syncFromDriver();
    });
    pairControl("mInput", "mValue", 1, (val) => { state.m = val; });

    pairControl("r2Input", "r2Value", 1, (val) => { state.r2 = val; syncSecond(); });
    pairControl("t2Input", "t2Value", 2, (val) => {
      state.driver2 = "T";
      state.T2 = val;
      syncSecond();
    });
    pairControl("v2Input", "v2Value", 2, (val) => {
      state.driver2 = "v";
      state.v2 = val;
      syncSecond();
    });
    // 질량은 운동학과 무관하므로 syncSecond()를 부르지 않는다 (r₂·v₂가 흔들리면 안 된다)
    pairControl("m2Input", "m2Value", 1, (val) => { state.m2 = val; });

    $("showSecond").addEventListener("change", (e) => {
      state.showSecond = e.target.checked;
      $("secondBlock").classList.toggle("hidden", !state.showSecond);
      $("cmpBox").classList.toggle("hidden", !state.showSecond);
      $("note1").classList.toggle("hidden", state.showSecond);
      updateControls();
      updateLegend();
      render();
    });

    $("linkMode").addEventListener("change", (e) => {
      state.linkMode = e.target.value;
      // 모드를 바꾸면 두 물체의 위치를 맞춰 다시 출발시킨다
      state.theta2 = state.theta;
      syncSecond();
      updateControls();
      render();
    });


    $("dthetaInput").addEventListener("input", (e) => {
      stopLimit();
      setDtheta(dthFromSlider(Number(e.target.value)));
    });

    $("dthetaFull").addEventListener("input", (e) => {
      stopLimit();
      setDtheta(dthFromSlider(Number(e.target.value)));
    });

    $("deriveOpen").addEventListener("click", openDerive);
    $("deriveClose").addEventListener("click", closeDerive);
    $("limitBtn").addEventListener("click", onLimitClick);
    $("alignToggle").addEventListener("click", toggleAlign);

    $("cutBtn").addEventListener("click", () => {
      if (!state.cut) doCut();
    });

    bindDrag();
    window.addEventListener("resize", render);
  }

  /* ---------------------------------------------------------
     시작
     --------------------------------------------------------- */
  function init() {
    state.r = Number($("rInput").value);
    state.T = Number($("tInput").value);
    state.m = Number($("mInput").value);
    state.r2 = Number($("r2Input").value);
    state.T2 = Number($("t2Input").value);
    state.m2 = Number($("m2Input").value);
    state.dthetaDeg = 60;
    state.linkMode = $("linkMode").value;
    state.driver = "T";
    state.driver2 = "T";
    syncFromDriver();

    bind();
    updateControls();
    updateLegend();
    updateStageHint();
    updateStatus();
    updatePlayButtons();
    setStep(1);
    setDtheta(state.dthetaDeg);
    requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
