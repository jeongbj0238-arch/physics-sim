/* ============================================================
   단진동
   교과서: (동아출판) 역학과 에너지 pp.94~97 「01 단진동」
   성취기준: [12역학03-01]

   1 용수철 진자      끌었다 놓으면 복원력으로 진동하고, 기록하면 사인 곡선이 된다  (그림 III-1·2, 문제 3)
   2 원운동의 그림자  등속 원운동하는 물체의 그림자는 단진동한다                  (그림 III-3·4)
   3 가속도와 변위    용수철 진자나 원운동의 x 기록에서 v·a를 기울기로 구한다       (p.96, 문제 4)

   ※ 진자는 해 보기(운동 센서)처럼 세로로 매단다. 그래야 기록이 교과서 그래프처럼 위아래로 그려진다.
      무거울수록 용수철이 더 늘어난 채 매달리고, 변위 x는 평형 위치에서 잰다 (위가 +).
   ※ 주기·진폭·기울기는 공식으로 띄우지 않는다. 기록한 변위에서 잰다.
      탭 3의 속도·가속도도 운동 센서처럼 변위 기록을 미분해서 얻는다.
   ============================================================ */

(() => {
  "use strict";

  /* ---------------------------------------------------------
     캔버스에 직접 그리는 색.
     CSS의 변수와는 별개의 하드코딩 상수다.
     색을 바꿀 때는 simple-harmonic.css와 여기를 함께 고쳐야 한다.
     --------------------------------------------------------- */
  const COLOR_STAGE  = "#ffffff";
  const COLOR_INK    = "#171717";
  const COLOR_BODY   = "#4d4d4d";
  const COLOR_MUTE   = "#8f8f8f";
  const COLOR_PAPER  = "#fafafa";   // 기록 화면
  const COLOR_SPRING = "#9e9e9e";
  const COLOR_A      = "#0070f3";   // 진자 A
  const COLOR_B      = "#e5620a";   // 진자 B
  const COLOR_VEL    = "#16a34a";   // 속도
  const COLOR_ACC    = "#dc2626";   // 가속도·복원력 — F = ma라 같은 색

  const G = 9.8;
  const A_MAX = 0.15;                // 끌 수 있는 가장 먼 거리 (m)
  const PULL = 0.12;                 // [당겼다 놓기]로 당기는 거리 (m)
  const K_MIN = 50;
  const K_MAX = 400;
  const M_MIN = 0.5;
  const M_MAX = 2;
  const STRETCH_MAX = (M_MAX * G) / K_MIN;   // 가장 많이 늘어난 채 매달릴 때 (m)
  const DT = 0.0005;                 // 계산 간격 (s)
  const SAMPLE_EVERY = 4;            // 4걸음(2 ms)마다 기록 — 시각을 비교하지 않고 걸음 수로 센다
  const SAMPLE_DT = DT * SAMPLE_EVERY;
  const TRACE_SEC = 4;               // 기록 화면에 담기는 시간 (s)
  const PAPER_TOP = 46;              // 기록 화면 위 끝 — 왼쪽 위 상태 표시와 겹치지 않게
  const N_SAMPLES = Math.round(TRACE_SEC / SAMPLE_DT) + 1;

  const $ = (id) => document.getElementById(id);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const TAU = 2 * Math.PI;
  const signed = (x, d = 2) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(d)}`;

  // 진자 하나 — x는 평형 위치에서 잰 변위 (위 +)
  function pendulum(name, color, k, m) {
    return {
      name, color, k, m, x: 0, v: 0, held: false,
      rec: new Float64Array(N_SAMPLES), hold: new Uint8Array(N_SAMPLES), head: 0, filled: 0,
      px: 0, py: 0,   // 화면에서 추의 위치 (끌기용)
    };
  }

  const pa = pendulum("A", COLOR_A, 100, 2);      // 탭 1 — 교과서 개념 확인 (k 100, m 2 kg)
  const pb = pendulum("B", COLOR_B, 400, 2);      // 탭 1 — k가 4배면 주기가 절반 (문제 3)
  const shadow = pendulum("", COLOR_INK, 1, 1);   // 탭 2 그림자 — 기록만 쓴다
  const compV = pendulum("", COLOR_VEL, 1, 1);    // 탭 2 원운동 속도의 세로 성분 기록
  const compA = pendulum("", COLOR_ACC, 1, 1);    // 탭 2 원운동 가속도의 세로 성분 기록
  const p3 = pendulum("", COLOR_INK, 100, 2);     // 탭 3 — 원운동을 고르면 그림자 높이를 기록한다

  const state = {
    tab: 1,
    paused: false,
    speed: 1,
    showB: true,
    edit: "a",           // 탭 1에서 k·m을 조절할 진자
    r2: 0.12,            // 탭 2 원운동의 반지름 = 진폭 (m)
    w2: 5,               // 탭 2 각속도 (rad/s)
    t2: 0,               // 탭 2 시계 — 처음 위치에서 출발한 뒤 지난 시간. 탭 2에 있을 때만 흐른다
    mode3: "spring",     // 탭 3에서 해석할 운동 — "spring" | "circle"
    r3: 0.12,            // 탭 3 원운동 (탭 2와 따로)
    w3: 5,
    t3: 0,
    tangent: false,      // 탭 3 기울기 보기
    dt: 0.2,             // 탭 3 할선의 Δt (s). 0이면 접선
    cursorB: null,       // 탭 2·3 일시정지 중 짚은 순간 (기록 번호). null이면 1초 전
  };
  let paper = null;      // 탭 2·3 기록 화면의 자리 — 세로축 끌기용

  let canvas = null;
  let lastG = null;
  let cardEls = [];
  let models = null;

  /* ---------------------------------------------------------
     물리 — 복원력 F = −kx 하나로 움직인다
     --------------------------------------------------------- */
  const omega = (p) => Math.sqrt(p.k / p.m);

  function active() {
    if (state.tab === 1) return state.showB ? [pa, pb] : [pa];
    return state.tab === 3 && state.mode3 === "spring" ? [p3] : [];
  }
  const circle3 = () => state.mode3 === "circle";

  // 그림자의 높이 — 처음 위치(원의 맨 오른쪽)에서 시작해 시계 반대 방향으로 돈다.
  // 원운동의 시계는 그 탭에 있을 때만 흐른다
  const shadowY = () => state.r2 * Math.sin(state.w2 * state.t2);

  let steps = 0;
  function physicsStep() {
    const list = active();
    for (const p of list) {
      if (p.held) {
        p.v = 0;
        continue;
      }
      const w2 = p.k / p.m;
      p.v -= 0.5 * w2 * p.x * DT;     // 속도 베를레 — 오래 돌려도 에너지가 새지 않는다
      p.x += p.v * DT;
      p.v -= 0.5 * w2 * p.x * DT;
    }
    if (state.tab === 2) state.t2 += DT;
    if (state.tab === 3 && circle3()) {
      state.t3 += DT;
      p3.x = state.r3 * Math.sin(state.w3 * state.t3);
    }
    if (++steps % SAMPLE_EVERY) return;
    list.forEach((p) => record(p, p.x));
    if (state.tab === 3 && circle3()) record(p3, p3.x);
    if (state.tab === 2) {
      // 원운동 속도·가속도의 세로 성분 — 미분 없이 원운동에서 바로 얻는다 (교과서 p.96)
      const w = state.w2;
      const th = w * state.t2;
      record(shadow, shadowY());
      record(compV, state.r2 * w * Math.cos(th));
      record(compA, -state.r2 * w * w * Math.sin(th));
    }
  }

  /* 기록 — 운동 센서처럼 일정한 간격으로 변위를 적는다 */
  function record(p, value) {
    p.rec[p.head] = value;
    p.hold[p.head] = p.held ? 1 : 0;
    p.head = (p.head + 1) % N_SAMPLES;
    p.filled = Math.min(N_SAMPLES, p.filled + 1);
  }
  const at = (p, back) => p.rec[(p.head - 1 - back + 2 * N_SAMPLES) % N_SAMPLES];   // back = 0이 가장 최근
  const heldAt = (p, back) => p.hold[(p.head - 1 - back + 2 * N_SAMPLES) % N_SAMPLES] === 1;
  function clearRec(p) {
    p.head = 0;
    p.filled = 0;
  }

  // 손을 놓은 뒤의 기록만 쓴다 — 쓸 수 있는 가장 오래된 back
  function freeSpan(p) {
    for (let b = 0; b < p.filled; b++) if (heldAt(p, b)) return b - 1;
    return p.filled - 1;
  }

  // 기록에서 잰 주기와 진폭 — 위로 지나가는 영점 사이 시간, 마지막 한 주기의 높낮이
  function measure(p) {
    const limit = freeSpan(p);
    const cross = [];
    for (let b = limit; b >= 1; b--) {
      const older = at(p, b);
      const newer = at(p, b - 1);
      if (older < 0 && newer >= 0) cross.push((-b + older / (older - newer)) * SAMPLE_DT);
    }
    if (cross.length < 2) return null;
    const T = (cross[cross.length - 1] - cross[0]) / (cross.length - 1);
    const nT = Math.min(limit, Math.round(T / SAMPLE_DT));
    let hi = -Infinity;
    let lo = Infinity;
    for (let b = 0; b <= nT; b++) {
      hi = Math.max(hi, at(p, b));
      lo = Math.min(lo, at(p, b));
    }
    const A = (hi - lo) / 2;
    return A < 0.003 ? null : { T, A };
  }

  // 탭 3 — 운동 센서처럼 변위 기록을 미분한다 (가운데 차분)
  const velAt = (p, b) => (at(p, b - 1) - at(p, b + 1)) / (2 * SAMPLE_DT);
  const accAt = (p, b) => (at(p, b - 1) - 2 * at(p, b) + at(p, b + 1)) / SAMPLE_DT ** 2;

  // a–x 그래프의 기울기 — 원점을 지나는 직선으로 최소제곱. 최근 1.5초
  function slopeAX(p) {
    const n = Math.min(freeSpan(p) - 1, Math.round(1.5 / SAMPLE_DT));
    let sxa = 0;
    let sxx = 0;
    for (let b = 1; b <= n; b++) {
      const x = at(p, b);
      sxa += x * accAt(p, b);
      sxx += x * x;
    }
    return n < 50 || sxx < 1e-5 ? null : sxa / sxx;
  }

  /* ---------------------------------------------------------
     그리기
     --------------------------------------------------------- */
  // 세로 배치. 매달려 늘어난 길이는 변위보다 작은 비율로 그린다 —
  // 같은 비율로 그리면 용수철이 화면을 다 차지해서 사인 곡선이 작아진다.
  // 탭 2·3은 x·v·a 세 줄을 위에서부터 쌓고 (미분 순서), 맨 위 x 줄을 진자·원과 같은 높이에 둔다.
  // 탭 2는 원이 작아지지 않게 x 줄을 넓게 준다
  function geom(w, h) {
    const massR = 13;
    let band;
    let yEq;
    let rows = null;
    if (state.tab === 2 || state.tab === 3) {
      const H = (h - PAPER_TOP - 30) / 6;
      const hx = state.tab === 2 ? 1.4 * H : H;
      const half = (3 * H - hx) / 2;
      rows = { x: PAPER_TOP + hx, v: PAPER_TOP + 2 * hx + half, a: PAPER_TOP + 2 * hx + 3 * half, half };
      band = hx - 8;
      yEq = rows.x;
    } else {
      band = 0.25 * h;
      yEq = 22 + band + 26 + 0.12 * h + massR;
    }
    const s = band / A_MAX;                       // 변위 m → px
    const stretchPx = (0.12 * h) / STRETCH_MAX;   // 매달려 늘어난 길이 m → px
    return {
      w, h, s, yEq, massR, band, rows,
      restPx: (p) => band + 26 + ((p.m * G) / p.k) * stretchPx,   // 평형일 때 용수철 길이
      Y: (x) => yEq - x * s,
    };
  }

  function label(ctx, text, x, y0, color, size = 12, align = "center", weight = "500") {
    ctx.save();
    ctx.font = `${weight} ${size}px Geist, 'Malgun Gothic', sans-serif`;
    ctx.textAlign = align;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
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

  function arrow(ctx, x1, y1, x2, y2, color, width = 2.5) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 3) return;
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    const head = Math.min(9, len * 0.5);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - ux * head * 0.8, y2 - uy * head * 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * head - uy * head * 0.5, y2 - uy * head + ux * head * 0.5);
    ctx.lineTo(x2 - ux * head + uy * head * 0.5, y2 - uy * head - ux * head * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawSpring(ctx, x, y1, y2) {
    const coils = 12;
    const lead = 6;
    const len = y2 - y1 - 2 * lead;
    ctx.save();
    ctx.strokeStyle = COLOR_SPRING;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y1 + lead);
    for (let i = 0; i < coils * 2; i++) ctx.lineTo(x + (i % 2 ? -9 : 9), y1 + lead + ((i + 0.5) / (coils * 2)) * len);
    ctx.lineTo(x, y2 - lead);
    ctx.lineTo(x, y2);
    ctx.stroke();
    ctx.restore();
  }

  // 매달린 용수철 진자 — 무거울수록, 용수철이 무를수록 더 늘어난 채 매달린다
  function drawPendulum(ctx, g, px, p, info) {
    const py = g.Y(p.x);
    const r = g.massR * (0.78 + (0.22 * (p.m - M_MIN)) / (M_MAX - M_MIN));
    const ySup = Math.max(8, g.yEq - r - g.restPx(p));   // x 줄이 맨 위인 탭 2·3은 천장이 화면 위 끝
    ctx.save();
    ctx.strokeStyle = COLOR_BODY;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px - 18, ySup);
    ctx.lineTo(px + 18, ySup);
    ctx.stroke();
    ctx.strokeStyle = "#c8c8c8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -16; i <= 12; i += 6) {
      ctx.moveTo(px + i, ySup);
      ctx.lineTo(px + i + 5, ySup - 6);
    }
    ctx.stroke();
    ctx.restore();
    drawSpring(ctx, px, ySup, py - r);
    ctx.save();
    ctx.fillStyle = p.color;
    roundRect(ctx, px - r, py - r, 2 * r, 2 * r, 4);
    ctx.fill();
    ctx.restore();
    if (p.name) label(ctx, p.name, px, py + 4.5, "#ffffff", 13, "center", "600");
    if (info) label(ctx, info, px, g.yEq + g.band + g.massR + 18, p.color === COLOR_INK ? COLOR_BODY : p.color, 11, "center", "600");
    p.px = px;
    p.py = py;
  }

  // 기록 화면 — 오른쪽 끝이 지금이고, 지난 기록은 왼쪽으로 흘러간다
  function drawPaper(ctx, g, xLeft, xRight, rows) {
    const top = PAPER_TOP;
    const bottom = g.h - 30;
    ctx.save();
    ctx.fillStyle = COLOR_PAPER;
    ctx.fillRect(xLeft, top, xRight - xLeft, bottom - top);
    ctx.strokeStyle = "#ececec";
    ctx.lineWidth = 1;
    ctx.strokeRect(xLeft + 0.5, top + 0.5, xRight - xLeft - 1, bottom - top - 1);
    ctx.strokeStyle = "#e3e3e3";   // 1초 눈금
    ctx.beginPath();
    for (let s = 1; s < TRACE_SEC; s++) {
      const x = Math.round(xRight - (s / TRACE_SEC) * (xRight - xLeft)) + 0.5;
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    ctx.stroke();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#bdbdbd";
    ctx.beginPath();
    rows.forEach((yy) => {
      ctx.moveTo(xLeft, Math.round(yy) + 0.5);
      ctx.lineTo(xRight, Math.round(yy) + 0.5);
    });
    ctx.stroke();
    ctx.restore();
    const oneSec = (xRight - xLeft) / TRACE_SEC;   // 1초 눈금 — 왼쪽 아래 (오른쪽 아래는 안내 문구 자리)
    ctx.save();
    ctx.strokeStyle = COLOR_BODY;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xLeft, bottom + 8);
    ctx.lineTo(xLeft, bottom + 12);
    ctx.lineTo(xLeft + oneSec, bottom + 12);
    ctx.lineTo(xLeft + oneSec, bottom + 8);
    ctx.stroke();
    ctx.restore();
    label(ctx, "1초", xLeft + oneSec / 2, bottom + 25, COLOR_BODY, 11);
    label(ctx, "← 지난 기록 · 오른쪽 끝이 지금", xLeft + oneSec + 12, bottom + 16, COLOR_MUTE, 11, "left");
  }

  // 기록 곡선. yOf(b)는 b번째 지난 기록을 화면 높이로 돌려준다. from부터 그린다
  function drawTrace(ctx, p, xLeft, xRight, yOf, color, width = 2.2, from = 0, to = p.filled) {
    if (to - from < 2) return;
    const dx = (xRight - xLeft) / (N_SAMPLES - 1);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let b = from; b < to; b += 2) {
      const x = xRight - b * dx;
      const yy = yOf(b);
      if (b === from) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawConnector(ctx, x1, x2, yy, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, yy);
    ctx.lineTo(x2, yy);
    ctx.stroke();
    ctx.restore();
  }

  /* 탭 1 — 진자 A·B와 두 기록 */
  function renderTab1(ctx, g) {
    const xLeft = 30;
    const xRight = g.w - 230;
    drawPaper(ctx, g, xLeft, xRight, [g.yEq]);
    const list = active();
    list.forEach((p) => drawTrace(ctx, p, xLeft, xRight, (b) => g.Y(at(p, b)), p.color));
    label(ctx, "평형 위치 (x = 0)", xLeft + 8, g.yEq - 8, COLOR_MUTE, 11, "left");
    label(ctx, "변위 x · 위 +", xLeft + 8, PAPER_TOP + 18, COLOR_MUTE, 11, "left");
    list.forEach((p) => {
      const px = p === pa ? xRight + 70 : xRight + 155;
      drawConnector(ctx, xRight, px - 16, g.Y(p.x), p.color);
      drawPendulum(ctx, g, px, p, `k ${p.k} · m ${p.m.toFixed(1)}`);
      // 복원력 — 늘 평형 위치 쪽. 길이는 힘의 크기에 비례
      const F = -p.k * p.x;
      const len = clamp(Math.abs(F) * 1.5, 0, 72);
      if (len > 4) {
        const y0 = g.Y(p.x);
        const y1 = y0 - Math.sign(F) * len;
        arrow(ctx, px - 27, y0, px - 27, y1, COLOR_ACC, 2.5);
        label(ctx, "F", px - 38, (y0 + y1) / 2 + 4, COLOR_ACC, 13, "center", "600");
      }
    });
    if (list.length) label(ctx, "복원력 F = −kx", g.w - 16, 32, COLOR_ACC, 12, "right", "600");
  }

  // 등속 원운동과 평행 광선, 기록 화면 오른쪽 끝(xRight)에 맺힌 그림자. 물체 자리를 돌려준다
  function drawOrbit(ctx, g, xRight, cx, R, th) {
    const cy = g.yEq;
    const ox = cx + R * Math.cos(th);
    const oy = cy - R * Math.sin(th);

    ctx.save();   // 평행 광선 — 오른쪽에서 왼쪽으로
    for (let i = -2; i <= 2; i++) {
      const yy = cy + i * Math.max(R, 30) * 0.5;
      arrow(ctx, g.w - 14, yy, cx + R + 22, yy, "#d4d4d4", 1.5);
    }
    ctx.restore();
    label(ctx, "평행 광선", g.w - 14, cy - Math.max(R, 30) - 12, COLOR_MUTE, 11, "right");

    ctx.save();   // 원 궤도
    ctx.strokeStyle = "#cfcfcf";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = COLOR_MUTE;
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, TAU);
    ctx.fill();
    ctx.restore();
    label(ctx, "등속 원운동", cx, cy - R - 14, COLOR_BODY, 12, "center", "600");

    drawConnector(ctx, xRight, ox, oy, COLOR_INK);
    ctx.save();   // 그림자와 물체
    ctx.fillStyle = COLOR_INK;
    ctx.beginPath();
    ctx.arc(xRight, oy, 6, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ox, oy, 7, 0, TAU);
    ctx.fill();
    ctx.restore();
    label(ctx, "그림자", xRight - 10, oy - 12, COLOR_INK, 12, "right", "600");
    return { ox, oy };
  }

  /* 탭 2 — 원운동의 그림자 (그림 III-3·4를 좌우로 뒤집어 시간이 오른쪽으로 흐르게) */
  function renderTab2(ctx, g) {
    const Rmax = A_MAX * g.s;
    const xLeft = 30;
    const xRight = g.w - 2 * Rmax - 130;
    const w = state.w2;
    const th = w * state.t2;
    const half = g.rows.half;
    const vS = state.r2 * w;            // 성분 줄은 원운동의 속력·가속도 크기로 꽉 차게
    const aS = state.r2 * w * w;
    const yV = (val) => g.rows.v - (val / vS) * (half - 4);
    const yA = (val) => g.rows.a - (val / aS) * (half - 4);
    drawPaper(ctx, g, xLeft, xRight, [g.yEq, g.rows.v, g.rows.a]);
    drawTrace(ctx, compV, xLeft, xRight, (b) => yV(at(compV, b)), COLOR_VEL, 2);
    drawTrace(ctx, compA, xLeft, xRight, (b) => yA(at(compA, b)), COLOR_ACC, 2);
    drawTrace(ctx, shadow, xLeft, xRight, (b) => g.Y(at(shadow, b)), COLOR_INK, 2.4);
    label(ctx, "그림자 높이 x = A sin θ", xLeft + 8, PAPER_TOP + 18, COLOR_INK, 11, "left", "600");
    label(ctx, `속도 성분 Aω cos θ · ±${vS.toFixed(2)} m/s`, xLeft + 8, g.rows.v - half + 14, COLOR_VEL, 11, "left", "600");
    label(ctx, `가속도 성분 −Aω² sin θ · ±${aS.toFixed(1)} m/s²`, xLeft + 8, g.rows.a - half + 14, COLOR_ACC, 11, "left", "600");
    paper = { xLeft, xRight };
    const [lo, hi] = cursorRange();
    if (hi >= lo) {
      const b = cursorAt(lo, hi);
      const cxv = drawCursor(ctx, g, xLeft, xRight, b);
      drawMarks(ctx, cxv, (xLeft + xRight) / 2, [
        [g.yEq, g.Y(at(shadow, b)), COLOR_INK, `x = ${signed(at(shadow, b), 3)} m`],
        [g.rows.v, yV(at(compV, b)), COLOR_VEL, `v = ${signed(at(compV, b))} m/s`],
        [g.rows.a, yA(at(compA, b)), COLOR_ACC, `a = ${signed(at(compA, b), 1)} m/s²`],
      ]);
    }

    const { ox, oy } = drawOrbit(ctx, g, xRight, xRight + 60 + Rmax, state.r2 * g.s, th);

    // 원운동의 속도(접선)·가속도(중심 쪽)와 그 세로 성분 = 그림자의 속도·가속도
    const LV = 46;
    const LA = 36;
    arrow(ctx, ox, oy, ox - LV * Math.sin(th), oy - LV * Math.cos(th), COLOR_VEL, 2.5);
    arrow(ctx, ox, oy, ox - LA * Math.cos(th), oy + LA * Math.sin(th), COLOR_ACC, 2.5);
    arrow(ctx, xRight + 11, oy, xRight + 11, oy - LV * Math.cos(th), COLOR_VEL, 2.5);
    arrow(ctx, xRight + 23, oy, xRight + 23, oy + LA * Math.sin(th), COLOR_ACC, 2.5);
    label(ctx, "v", ox - (LV + 10) * Math.sin(th), oy - (LV + 10) * Math.cos(th) + 4, COLOR_VEL, 13, "center", "600");
    label(ctx, "a", ox - (LA + 10) * Math.cos(th), oy + (LA + 10) * Math.sin(th) + 4, COLOR_ACC, 13, "center", "600");
    // 성분의 크기 — 미분 없이 원운동에서 바로 읽는다
    label(ctx, `${signed(vS * Math.cos(th))} m/s`, xRight - 10, oy + 18, COLOR_VEL, 12, "right", "600");
    label(ctx, `${signed(-aS * Math.sin(th), 1)} m/s²`, xRight - 10, oy + 33, COLOR_ACC, 12, "right", "600");
    // 성분 기록의 지금 점
    ctx.save();
    ctx.fillStyle = COLOR_VEL;
    ctx.beginPath();
    ctx.arc(xRight, g.rows.v - Math.cos(th) * (half - 4), 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COLOR_ACC;
    ctx.beginPath();
    ctx.arc(xRight, g.rows.a + Math.sin(th) * (half - 4), 4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /* 탭 3 — x·v·a 세 기록 (x는 진자·원과 같은 높이) */
  function renderTab3(ctx, g) {
    const circle = circle3();
    const Rmax = A_MAX * g.s;
    const xLeft = 30;
    const xRight = circle ? g.w - 2 * Rmax - 110 : g.w - 150;
    const half = g.rows.half;
    const w = circle ? state.w3 : omega(p3);
    const vScale = w * A_MAX;          // 이 속력이면 줄의 끝까지
    const aScale = w * w * A_MAX;
    const yV = (val) => g.rows.v - clamp(val / vScale, -1.2, 1.2) * (half - 4);
    const yA = (val) => g.rows.a - clamp(val / aScale, -1.2, 1.2) * (half - 4);
    drawPaper(ctx, g, xLeft, xRight, [g.yEq, g.rows.v, g.rows.a]);
    label(ctx, `변위 x · ±${A_MAX.toFixed(2)} m`, xLeft + 8, g.yEq - half + 14, COLOR_INK, 11, "left", "600");
    label(ctx, `속도 v · ±${vScale.toFixed(2)} m/s`, xLeft + 8, g.rows.v - half + 14, COLOR_VEL, 11, "left", "600");
    label(ctx, `가속도 a · ±${aScale.toFixed(1)} m/s²`, xLeft + 8, g.rows.a - half + 14, COLOR_ACC, 11, "left", "600");
    // 미분은 앞뒤 기록이 있어야 하므로 가장 최근 하나와 가장 오래된 하나는 빼고 그린다
    drawTrace(ctx, p3, xLeft, xRight, (b) => yV(velAt(p3, b)), COLOR_VEL, 2, 1, p3.filled - 1);
    drawTrace(ctx, p3, xLeft, xRight, (b) => yA(accAt(p3, b)), COLOR_ACC, 2, 1, p3.filled - 1);
    drawTrace(ctx, p3, xLeft, xRight, (b) => g.Y(at(p3, b)), COLOR_INK, 2.2);
    paper = { xLeft, xRight };
    const [lo, hi] = cursorRange();
    if (hi >= lo) {
      const b = cursorAt(lo, hi);
      const cxv = drawCursor(ctx, g, xLeft, xRight, b);
      if (state.tangent) drawSlopes(ctx, g, xLeft, xRight, b, yV, yA);
      drawMarks(ctx, cxv, (xLeft + xRight) / 2, [
        [g.yEq, g.Y(at(p3, b)), COLOR_INK, `x = ${signed(at(p3, b), 3)} m`],
        [g.rows.v, yV(velAt(p3, b)), COLOR_VEL, `v = ${signed(velAt(p3, b))} m/s`],
        [g.rows.a, yA(accAt(p3, b)), COLOR_ACC, `a = ${signed(accAt(p3, b), 1)} m/s²`],
      ]);
    }
    if (circle) {
      drawOrbit(ctx, g, xRight, xRight + 40 + Rmax, state.r3 * g.s, state.w3 * state.t3);
    } else {
      drawConnector(ctx, xRight, xRight + 59, g.Y(p3.x), COLOR_INK);
      drawPendulum(ctx, g, xRight + 75, p3, "");
    }
  }

  // 세로축 — 같은 순간의 x·v·a를 한 줄 위에서 비교한다.
  // 재생 중엔 1초 전 자리에 고정, 일시정지하면 끌어 옮긴다
  function cursorRange() {
    if (state.tab === 2) return [1, shadow.filled - 2];
    const hS = slopeSpan();
    return [hS + 2, Math.min(freeSpan(p3), p3.filled - 2) - hS - 2];
  }

  function cursorAt(lo, hi) {
    return clamp(state.paused && state.cursorB != null ? state.cursorB : Math.round(1 / SAMPLE_DT), lo, hi);
  }

  function drawCursor(ctx, g, xLeft, xRight, b) {
    const x = xRight - b * ((xRight - xLeft) / (N_SAMPLES - 1));
    ctx.save();
    ctx.strokeStyle = "rgba(23, 23, 23, 0.45)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, PAPER_TOP);
    ctx.lineTo(x, g.h - 30);
    ctx.stroke();
    if (state.paused) {   // 끌 수 있는 손잡이
      ctx.fillStyle = COLOR_INK;
      roundRect(ctx, x - 7, PAPER_TOP - 2, 14, 12, 3);
      ctx.fill();
    }
    ctx.restore();
    return x;
  }

  // 세로축과 세 곡선이 만나는 점과 그 값. 글자는 화면 가운데 쪽, 줄 가운데 쪽으로 — 줄 끝은 기울기 글자 자리
  function drawMarks(ctx, x, mid, marks) {
    const side = x > mid ? "right" : "left";
    const lx = x + (side === "right" ? -10 : 10);
    marks.forEach(([rowY, py, color, text]) => {
      ctx.save();
      ctx.fillStyle = color;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, py, 5, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      label(ctx, text, lx, py > rowY ? py - 9 : py + 18, color, 12, side, "600");
    });
  }

  // 기울기 보기 — 세로축 위 세 점의 접선. x 곡선의 기울기가 v, v 곡선의 기울기가 a (수학의 "변위를 미분하면 속도").
  // Δt > 0이면 짚은 순간 앞뒤 Δt/2 두 점을 잇는 할선(평균 변화율), 0이면 접선(순간 변화율).
  // 할선 기울기는 아래 줄에 빈 동그라미로 찍는다 — Δt를 줄이면 실제 곡선 위로 다가간다
  function slopeSpan() {
    return Math.max(1, Math.round(state.dt / 2 / SAMPLE_DT));
  }

  function drawSlopes(ctx, g, xLeft, xRight, b, yVv, yAa) {
    const hS = slopeSpan();
    const dx = (xRight - xLeft) / (N_SAMPLES - 1);
    const X = (bb) => xRight - bb * dx;
    const span = 2 * hS * SAMPLE_DT;
    const half = g.rows.half;
    const yX = (val) => g.Y(val);
    const xSlope = (at(p3, b - hS) - at(p3, b + hS)) / span;                // 평균 변화율 Δx/Δt
    const vSlope = (velAt(p3, b - hS) - velAt(p3, b + hS)) / span;          // Δv/Δt
    const isTangent = state.dt === 0;

    const line = (rowY, rowHalf, y1, y2, color) => {
      const x1 = X(b + hS);
      const x2 = X(b - hS);
      const k = (y2 - y1) / (x2 - x1 || 1);
      const ext = Math.max(60, (x2 - x1) / 2 + 36);
      const xm = (x1 + x2) / 2;
      const ym = (y1 + y2) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(xLeft, rowY - rowHalf, xRight - xLeft, 2 * rowHalf);
      ctx.clip();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xm - ext, ym - k * ext);
      ctx.lineTo(xm + ext, ym + k * ext);
      ctx.stroke();
      if (!isTangent) {
        ctx.fillStyle = color;
        [[x1, y1], [x2, y2]].forEach(([px, py]) => {
          ctx.beginPath();
          ctx.arc(px, py, 3.5, 0, TAU);
          ctx.fill();
        });
      }
      ctx.restore();
    };
    const hollow = (px, py, color) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, clamp(py, PAPER_TOP + 4, g.h - 34), 5.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    // x 곡선 → 기울기가 v
    line(g.yEq, half, yX(at(p3, b + hS)), yX(at(p3, b - hS)), COLOR_INK);
    hollow(X(b), yVv(xSlope), COLOR_VEL);
    // v 곡선 → 기울기가 a
    line(g.rows.v, half, yVv(velAt(p3, b + hS)), yVv(velAt(p3, b - hS)), COLOR_VEL);
    hollow(X(b), yAa(vSlope), COLOR_ACC);
    // a 곡선의 접선 — 선만 그린다
    line(g.rows.a, half, yAa(accAt(p3, b + hS)), yAa(accAt(p3, b - hS)), COLOR_ACC);

    const name = isTangent ? "접선 기울기" : `할선 기울기 (Δt ${state.dt.toFixed(2)} s)`;
    const side = X(b) > (xLeft + xRight) / 2 ? "right" : "left";
    const lx = X(b) + (side === "right" ? -10 : 10);
    // 점이 줄 아래쪽이면 줄 위 끝에, 위쪽이면 아래 끝에 적는다
    const edge = (rowY, py) => (py > rowY ? rowY - half + 16 : rowY + half - 6);
    label(ctx, `x의 ${name} = ${signed(xSlope)} m/s → v`, lx, edge(g.yEq, yX(at(p3, b))), COLOR_INK, 12, side, "600");
    label(ctx, `v의 ${name} = ${signed(vSlope, 1)} m/s² → a`, lx, edge(g.rows.v, yVv(velAt(p3, b))), COLOR_VEL, 12, side, "600");
  }

  function render() {
    const { w, h, ctx } = SimUtils.fitCanvas(canvas);
    ctx.fillStyle = COLOR_STAGE;
    ctx.fillRect(0, 0, w, h);
    const g = geom(w, h);
    lastG = g;
    if (state.tab === 1) renderTab1(ctx, g);
    else if (state.tab === 2) renderTab2(ctx, g);
    else renderTab3(ctx, g);
  }

  // 카드 그래프 — 탭 3 에너지 막대만 쓴다
  function drawStrip(cv, spec) {
    const { w, h, ctx } = SimUtils.fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    if (!spec) return;
    const bw = w - 2;
    const bh = 18;
    const y0 = Math.round((h - bh) / 2);
    ctx.fillStyle = "#f2f2f2";
    roundRect(ctx, 1, y0, bw, bh, 4);
    ctx.fill();
    ctx.save();
    roundRect(ctx, 1, y0, bw, bh, 4);
    ctx.clip();
    const kw = bw * clamp(spec.ke / spec.ref, 0, 1);
    const pw = bw * clamp(spec.pe / spec.ref, 0, 1 - kw / bw);
    ctx.fillStyle = COLOR_VEL;
    ctx.fillRect(1, y0, kw, bh);
    ctx.fillStyle = COLOR_A;
    ctx.fillRect(1 + kw, y0, pw, bh);
    ctx.restore();
  }

  /* ---------------------------------------------------------
     카드 — 탭마다 내용을 바꿔 끼운다
     --------------------------------------------------------- */
  function cardsTab1() {
    return [pa, pb].map((p) => {
      const shown = p === pa || state.showB;
      const m = shown ? measure(p) : null;
      return {
        name: `진자 ${p.name}`, color: p.color,
        tag: !shown ? { text: "꺼짐" } : p.held ? { text: "잡고 있음" } : null,
        sym: "T", val: m ? m.T.toFixed(2) : null, unit: "s",
        rows: [
          { k: "진폭", v: m ? `${m.A.toFixed(3)} m` : "–" },
          { k: "k · m", v: `${p.k} N/m · ${p.m.toFixed(1)} kg` },
        ],
        strip: null,
        legend: [],
        f1: shown ? `비교 · 2π√(m/k) = ${(TAU * Math.sqrt(p.m / p.k)).toFixed(2)} s` : "진자 B를 켜면 두 주기를 비교할 수 있다",
      };
    });
  }

  function cardsTab2() {
    const w = state.w2;
    const m = measure(shadow);
    return [
      {
        name: "원운동", color: COLOR_INK, tag: null,
        sym: "ω", val: w.toFixed(2), unit: "rad/s",
        rows: [
          { k: "반지름", v: `${state.r2.toFixed(2)} m` },
          { k: "주기 2π/ω", v: `${(TAU / w).toFixed(2)} s` },
        ],
        strip: null,
        legend: [],
        f1: `속력 Aω = ${(state.r2 * w).toFixed(2)} m/s · 가속도 Aω² = ${(state.r2 * w * w).toFixed(1)} m/s²`,
      },
      {
        name: "그림자 기록", color: COLOR_INK, tag: null,
        sym: "T", val: m ? m.T.toFixed(2) : null, unit: "s",
        rows: [
          { k: "진폭", v: m ? `${m.A.toFixed(3)} m` : "–" },
          { k: "그림자 높이", v: `${signed(shadowY(), 3)} m` },
        ],
        strip: null,
        legend: [],
        f1: `기록에서 잰 주기 · 2π/ω = ${(TAU / w).toFixed(2)} s와 비교`,
      },
    ];
  }

  function cardsTab3() {
    const slope = slopeAX(p3);
    const w = slope != null && slope < 0 ? Math.sqrt(-slope) : null;
    const m = measure(p3);
    const ready = p3.filled > 3;
    const x = ready ? at(p3, 1) : p3.x;
    const v = ready ? velAt(p3, 1) : 0;
    const ke = 0.5 * p3.m * v * v;
    const pe = 0.5 * p3.k * x * x;
    return [
      {
        name: "가속도와 변위", color: COLOR_INK, tag: null,
        sym: "기울기", val: slope != null ? slope.toFixed(1) : null, unit: "1/s²",
        rows: [
          { k: "ω = √(−기울기)", v: w ? `${w.toFixed(2)} rad/s` : "–" },
          { k: "주기 2π/ω", v: w ? `${(TAU / w).toFixed(2)} s` : "–" },
        ],
        strip: null,
        legend: [],
        f1: m ? `a = −ω²x · 기록에서 잰 주기 ${m.T.toFixed(2)} s` : "기록이 쌓이면 잰다",
      },
      circle3() ? {
        name: "원운동", color: COLOR_INK, tag: null,
        sym: "ω", val: state.w3.toFixed(2), unit: "rad/s",
        rows: [
          { k: "반지름", v: `${state.r3.toFixed(2)} m` },
          { k: "주기 2π/ω", v: `${(TAU / state.w3).toFixed(2)} s` },
        ],
        strip: null,
        legend: [],
        f1: "설정한 ω — 왼쪽 √(−기울기)와 비교",
      } : {
        name: "에너지", color: COLOR_INK, tag: null,
        sym: "합", val: (ke + pe).toFixed(3), unit: "J",
        rows: [
          { k: "운동 ½mv²", v: `${ke.toFixed(3)} J`, cls: "is-vel" },
          { k: "퍼텐셜 ½kx²", v: `${pe.toFixed(3)} J`, cls: "is-a" },
        ],
        strip: { ke, pe, ref: 0.5 * p3.k * A_MAX * A_MAX },
        legend: [{ color: COLOR_VEL, text: "운동 에너지" }, { color: COLOR_A, text: "퍼텐셜 에너지 (평형 위치 기준)" }],
        f1: "합이 늘 같다 — 역학적 에너지 보존",
      },
    ];
  }

  function applyCard(el, m) {
    el.name.textContent = m.name;
    el.name.style.color = m.color === COLOR_INK ? "" : m.color;
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
    el.strip.classList.toggle("hidden", !m.strip);
    const leg = m.legend.map((l) => `<span><i style="border-color:${l.color}"></i>${l.text}</span>`).join("");
    if (el.legendKey !== leg) {
      el.legend.innerHTML = leg;
      el.legendKey = leg;
    }
    el.f1.textContent = m.f1 || "";
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

  // k·m 입력이 가리키는 진자
  function target() {
    if (state.tab === 1) return state.edit === "a" ? pa : pb;
    return p3;
  }

  function syncInputs() {
    const p = target();
    document.querySelectorAll(".k-input, .k-num").forEach((el) => { el.value = p.k; });
    document.querySelectorAll(".m-input").forEach((el) => { el.value = p.m; });
    document.querySelectorAll(".m-num").forEach((el) => { el.value = p.m.toFixed(1); });
    [["r2", 2], ["w2", 1], ["r3", 2], ["w3", 1]].forEach(([key, d]) => {
      $(key + "Input").value = state[key];
      $(key + "Num").value = state[key].toFixed(d);
    });
    document.querySelectorAll("#mode3Seg button").forEach((b) => b.classList.toggle("is-active", b.dataset.mode === state.mode3));
    document.querySelectorAll(".spring-only").forEach((el) => el.classList.toggle("hidden", circle3()));
    document.querySelectorAll(".circle-only").forEach((el) => el.classList.toggle("hidden", !circle3()));
    document.querySelectorAll("#editSeg button").forEach((b) => b.classList.toggle("is-active", b.dataset.edit === state.edit));
    $("bBtn").classList.toggle("is-on", state.showB);
    $("bBtn").setAttribute("aria-pressed", String(state.showB));
    document.querySelector('#editSeg button[data-edit="b"]').disabled = !state.showB;
  }

  // 진동 중에 용수철을 바꿔 끼울 수는 없으니, k·m이 바뀌면 그 진자를 다시 당겼다 놓는다
  function changed(p) {
    const moving = Math.abs(p.x) > 0.002 || Math.abs(p.v) > 0.01;
    clearRec(p);
    p.held = false;
    p.v = 0;
    p.x = moving ? -PULL : 0;
  }

  function setK(v) {
    const p = target();
    const k = Math.round(clamp(Number(v) || 100, K_MIN, K_MAX) / 10) * 10;
    if (k !== p.k) {
      p.k = k;
      changed(p);
      updateStatus();
    }
    syncInputs();
  }

  function setM(v) {
    const p = target();
    const m = Math.round(clamp(Number(v) || 1, M_MIN, M_MAX) * 10) / 10;
    if (m !== p.m) {
      p.m = m;
      changed(p);
      updateStatus();
    }
    syncInputs();
  }

  // 원운동 반지름(r2·r3)과 각속도(w2·w3). 바꾸면 처음 위치에서 다시 돈다
  function setCircle(key, v) {
    const isR = key[0] === "r";
    const val = isR ? Math.round(clamp(Number(v) || 0.12, 0.05, A_MAX) * 100) / 100
      : Math.round(clamp(Number(v) || 5, 1, 10) * 10) / 10;
    if (val !== state[key]) {
      state[key] = val;
      if (key.endsWith("2")) restart2();
      else restart3();
      updateStatus();
    }
    syncInputs();
  }

  // 처음 위치(원의 맨 오른쪽, 그림자 x = 0)에서 출발한다
  function restart2() {
    state.t2 = 0;
    clearRec(shadow);
    clearRec(compV);
    clearRec(compA);
  }

  function restart3() {
    state.t3 = 0;
    p3.held = false;
    p3.x = 0;
    p3.v = 0;
    clearRec(p3);
  }

  function setMode3(mode) {
    if (mode === state.mode3) return;
    state.mode3 = mode;
    state.cursorB = null;
    if (circle3()) {
      restart3();
    } else {   // 용수철로 돌아오면 당겼다 놓은 채로
      clearRec(p3);
      p3.held = false;
      p3.x = -PULL;
      p3.v = 0;
    }
    syncInputs();
    updateStatus();
    lastCards = 0;
  }

  function release() {
    active().forEach((p) => {
      p.held = false;
      p.x = -PULL;
      p.v = 0;
      clearRec(p);
    });
    if (state.paused) togglePause();
  }

  function toggleB() {
    state.showB = !state.showB;
    if (state.showB) {
      pb.held = false;
      pb.x = pa.x;   // 켜는 순간 A와 같은 자리에서 출발 — 주기 차이가 바로 보인다
      pb.v = 0;
      clearRec(pb);
    } else if (state.edit === "b") {
      state.edit = "a";
    }
    syncInputs();
    updateStatus();
  }

  function setTab(n) {
    if (n === state.tab) return;
    state.tab = n;
    state.cursorB = null;
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("is-active", Number(b.dataset.tab) === n));
    document.querySelectorAll(".ctrl-pane").forEach((p) => p.classList.toggle("hidden", Number(p.dataset.pane) !== n));
    syncInputs();
    updateStatus();
    lastCards = 0;
  }

  function toggleTangent() {
    state.tangent = !state.tangent;
    $("tangentBtn").classList.toggle("is-on", state.tangent);
    $("tangentBtn").setAttribute("aria-pressed", String(state.tangent));
    updateStatus();
  }

  function setDt(v) {
    state.dt = Math.round(clamp(Number(v) || 0, 0, 0.3) * 50) / 50;
    $("dtInput").value = state.dt;
    $("dtNum").value = state.dt.toFixed(2);
  }

  function togglePause() {
    state.paused = !state.paused;
    if (!state.paused) state.cursorB = null;   // 다시 돌면 세로축은 1초 전으로
    $("pauseBtn").textContent = state.paused ? "계속" : "일시정지";
    updateStatus();
  }

  function reset() {
    if (state.tab === 2) {
      restart2();
    } else if (state.tab === 3 && circle3()) {
      restart3();
    } else {
      active().forEach((p) => {
        p.held = false;
        p.x = 0;
        p.v = 0;
        clearRec(p);
      });
    }
    if (state.paused) togglePause();
  }

  function updateStatus() {
    const pm = (p) => `k ${p.k} N/m · m ${p.m.toFixed(1)} kg`;
    let tag;
    if (state.tab === 1) tag = `A ${pm(pa)}${state.showB ? `  |  B ${pm(pb)}` : ""}`;
    else if (state.tab === 2) tag = `반지름 ${state.r2.toFixed(2)} m · ω ${state.w2.toFixed(1)} rad/s`;
    else tag = circle3() ? `원운동 · 반지름 ${state.r3.toFixed(2)} m · ω ${state.w3.toFixed(1)} rad/s` : pm(p3);
    if (state.paused) tag += " · 일시정지";
    $("statusTag").textContent = tag;
    const speed = { 1: "실제 빠르기", 0.5: "1/2로 느리게", 0.25: "1/4로 느리게" }[state.speed];
    $("stageHint").textContent = state.tab === 1 ? `추를 끌었다 놓아도 된다 · ${speed}`
      : state.paused ? `세로축을 끌어 같은 순간의 x·v·a를 비교한다 · ${speed}`
        : state.tab === 2 ? `그림자는 원운동의 높이만 따라간다 · 일시정지하면 세로축을 끈다 · ${speed}`
          : `속도·가속도는 변위 기록의 기울기로 구한다 · 일시정지하면 세로축을 끈다 · ${speed}`;
  }

  /* 끌기 — 추를 잡고 위아래로 (마우스·터치 모두). 탭 2는 원운동에 맞춰 움직이므로 잡지 않는다 */
  function bindDrag() {
    let dragging = null;
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const hit = (pt) => (state.tab === 2 ? null : active().find((p) => Math.hypot(pt.x - p.px, pt.y - p.py) < 24) || null);
    const move = (pt) => {
      dragging.x = clamp((lastG.yEq - pt.y) / lastG.s, -A_MAX, A_MAX);
    };
    // 탭 2·3 일시정지 중 — 기록 화면을 눌러 끌면 세로축이 옮겨 간다
    let scrubbing = false;
    const onPaper = (pt) => state.tab !== 1 && state.paused && paper
      && pt.x >= paper.xLeft && pt.x <= paper.xRight && pt.y >= PAPER_TOP - 4 && pt.y <= lastG.h - 30;
    const scrub = (pt) => {
      const dx = (paper.xRight - paper.xLeft) / (N_SAMPLES - 1);
      const [lo, hi] = cursorRange();
      state.cursorB = clamp(Math.round((paper.xRight - pt.x) / dx), lo, Math.max(lo, hi));
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (!lastG) return;
      const p = hit(pos(e));
      if (!p && onPaper(pos(e))) {
        e.preventDefault();
        scrubbing = true;
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 포인터가 이미 사라졌으면 잡지 않고 진행 */ }
        scrub(pos(e));
        return;
      }
      if (!p) return;
      e.preventDefault();
      dragging = p;
      p.held = true;
      p.v = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 포인터가 이미 사라졌으면 잡지 않고 진행 */ }
      move(pos(e));
      canvas.style.cursor = "grabbing";
      if (state.paused) togglePause();
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!lastG) return;
      if (scrubbing) {
        scrub(pos(e));
        return;
      }
      if (dragging) {
        move(pos(e));
        return;
      }
      canvas.style.cursor = hit(pos(e)) ? "grab" : onPaper(pos(e)) ? "ew-resize" : "default";
    });
    const end = () => {
      scrubbing = false;
      if (!dragging) return;
      dragging.held = false;   // 가만히 놓는다 — 놓는 순간 속도 0
      dragging.v = 0;
      dragging = null;
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
  let stepAcc = 0;

  function frame(ts) {
    const dt = lastTs == null ? 0 : Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    if (!state.paused && dt > 0) {
      stepAcc += dt * state.speed;
      while (stepAcc >= DT) {
        physicsStep();
        stepAcc -= DT;
      }
    }
    render();
    models = state.tab === 1 ? cardsTab1() : state.tab === 2 ? cardsTab2() : cardsTab3();
    cardEls.forEach((el, i) => drawStrip(el.strip, models[i].strip));
    if (ts - lastCards > 100) {
      cardEls.forEach((el, i) => applyCard(el, models[i]));
      lastCards = ts;
    }
    requestAnimationFrame(frame);
  }

  function bind() {
    $("pauseBtn").addEventListener("click", togglePause);
    $("resetBtn").addEventListener("click", reset);
    document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => setTab(Number(b.dataset.tab))));
    document.querySelectorAll(".release-btn").forEach((b) => b.addEventListener("click", release));
    $("restartBtn").addEventListener("click", restart2);
    $("bBtn").addEventListener("click", toggleB);
    document.querySelectorAll("#editSeg button").forEach((b) => b.addEventListener("click", () => {
      state.edit = b.dataset.edit;
      syncInputs();
    }));
    document.querySelectorAll(".k-input").forEach((el) => el.addEventListener("input", (e) => setK(e.target.value)));
    document.querySelectorAll(".k-num").forEach((el) => el.addEventListener("change", (e) => setK(e.target.value)));
    document.querySelectorAll(".m-input").forEach((el) => el.addEventListener("input", (e) => setM(e.target.value)));
    document.querySelectorAll(".m-num").forEach((el) => el.addEventListener("change", (e) => setM(e.target.value)));
    ["r2", "w2", "r3", "w3"].forEach((key) => {
      $(key + "Input").addEventListener("input", (e) => setCircle(key, e.target.value));
      $(key + "Num").addEventListener("change", (e) => setCircle(key, e.target.value));
    });
    $("restart3Btn").addEventListener("click", restart3);
    document.querySelectorAll("#mode3Seg button").forEach((b) => b.addEventListener("click", () => setMode3(b.dataset.mode)));
    $("tangentBtn").addEventListener("click", toggleTangent);
    $("dtInput").addEventListener("input", (e) => setDt(e.target.value));
    $("dtNum").addEventListener("change", (e) => setDt(e.target.value));
    document.querySelectorAll(".num").forEach((el) =>
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); }));
    $("speedSelect").addEventListener("change", (e) => {
      state.speed = Number(e.target.value);
      updateStatus();
    });
    $("settingsToggle").addEventListener("click", () => $("settingsOverlay").classList.remove("hidden"));
    $("settingsClose").addEventListener("click", () => $("settingsOverlay").classList.add("hidden"));
    $("settingsBackdrop").addEventListener("click", () => $("settingsOverlay").classList.add("hidden"));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") $("settingsOverlay").classList.add("hidden");
    });
    bindDrag();
  }

  function init() {
    canvas = $("simCanvas");
    cardEls = [...document.querySelectorAll(".obs-card")].map((card) => {
      const q = (role) => card.querySelector(`[data-role="${role}"]`);
      return {
        name: q("name"), tag: q("tag"), fbox: q("fbox"), sym: q("sym"), val: q("val"), unit: q("unit"),
        k: [q("k1"), q("k2")], v: [q("v1"), q("v2")], strip: q("strip"), legend: q("legend"), f1: q("f1"), legendKey: null,
      };
    });
    bind();
    // 열자마자 움직이게 — 탭 1은 두 진자를 함께 놓고, 탭 2는 처음 위치에서, 탭 3은 당겨 놓은 채로
    [pa, pb, p3].forEach((p) => { p.x = -PULL; });
    restart2();
    setDt(state.dt);
    syncInputs();
    updateStatus();
    requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
