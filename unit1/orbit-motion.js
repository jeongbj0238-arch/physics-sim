/* ============================================================
   천체의 운동과 중력 시뮬레이터
   교과서: (동아출판) 역학과 에너지 pp.28~35 「04 천체의 운동과 중력」
   성취기준: [12역학01-04] [12역학01-05]

   1 발사    발사 속력에 따라 추락 → 원 → 타원 → 탈출 (교과서 p.32 그림 I-25)
   2 중력    mv²/r = GMm/r² → T² = (4π²/GM)r³, 인공위성 정량   (p.31)
   3 케플러  2법칙 면적 · 3법칙(실제 8행성 관측 자료 + 내 궤도)  (p.29)
   4 탈출    v = √(2GM/R) 과 행성별 대기 구성                    (p.33)

   ※ 주기 T는 케플러 공식으로 계산하지 않고 궤도를 실제로 적분해서 잰다.
      공식으로 구하면 T²/R³ 이 일정한 것이 당연해져서 확인의 의미가 없다.
   ============================================================ */

(() => {
  "use strict";

  /* ---------------------------------------------------------
     캔버스에 직접 그리는 색.
     CSS의 --accent 등과는 별개의 하드코딩 상수다.
     색을 바꿀 때는 orbit-motion.css와 여기를 함께 고쳐야 한다.
     --------------------------------------------------------- */
  const COLOR_STAGE   = "#0d0d0d";
  const COLOR_GRID    = "#1c1c1c";
  const COLOR_AXIS    = "#262626";
  const COLOR_BODY    = "#2c333d";
  const COLOR_BODY_RIM= "#4c5765";
  const COLOR_ATM     = "#3b6ea8";
  const COLOR_ORBIT   = "#1ed760";   // 닫힌 궤도
  const COLOR_FALL    = "#f3727f";   // 추락
  const COLOR_ESCAPE  = "#539df5";   // 탈출
  const COLOR_INK     = "#ffffff";
  const COLOR_MUTED   = "#b3b3b3";
  const COLOR_DIM     = "#7c7c7c";
  const COLOR_TRAIL   = "#3a3a3a";
  const COLOR_MARKER  = "#ffa42b";

  const G = 6.674e-11;
  const R_GAS = 8.314;
  const C_LIGHT = 299792458;
  const TAU = Math.PI * 2;
  const EARTH_M = 5.972e24;

  const V_SPAN = 1.35;      // 슬라이더 오른쪽 끝 = 탈출 속도의 1.35배
  const SLIDER_STEPS = 1000;
  const DT_K = 0.0008;      // 적분 간격 계수 (한 바퀴에 약 7800 스텝)
  const MAX_STEPS = 40000;
  const CIRCLE_TOL = 0.012; // 이심률이 이보다 작으면 "원 궤도"로 본다
  /* 대기를 붙잡으려면 탈출 속도가 분자 평균 속력의 몇 배여야 하는가.
     10배로 잡으면 태양계 천체가 전부 실제와 맞는다
     (지구는 수소·헬륨을 잃고 질소·산소를 붙잡고, 달은 아무것도 못 붙잡고,
      화성은 CO₂만, 목성은 수소까지 붙잡는다). */
  const RETAIN_FACTOR = 10;

  /* ---------------------------------------------------------
     내장 자료
     --------------------------------------------------------- */
  const BODIES = [
    { key: "earth",   name: "지구",   M: 5.972e24, R: 6371e3,  T: 288, atm: "N₂ 78% · O₂ 21%" },
    { key: "moon",    name: "달",     M: 7.342e22, R: 1737e3,  T: 250, atm: "거의 없음" },
    { key: "mercury", name: "수성",   M: 3.301e23, R: 2440e3,  T: 440, atm: "거의 없음" },
    { key: "venus",   name: "금성",   M: 4.867e24, R: 6052e3,  T: 737, atm: "CO₂ 96%" },
    { key: "mars",    name: "화성",   M: 6.417e23, R: 3390e3,  T: 210, atm: "CO₂ 95%" },
    { key: "jupiter", name: "목성",   M: 1.898e27, R: 71492e3, T: 165, atm: "H₂ 90% · He 10%" },
    { key: "saturn",  name: "토성",   M: 5.683e26, R: 60268e3, T: 134, atm: "H₂ · He" },
    { key: "uranus",  name: "천왕성", M: 8.681e25, R: 25559e3, T: 76,  atm: "H₂ · He · CH₄" },
    { key: "neptune", name: "해왕성", M: 1.024e26, R: 24764e3, T: 72,  atm: "H₂ · He · CH₄" },
  ];

  /* 태양계 행성 관측 자료 — 긴반지름(AU), 공전 주기(년)
     ※ 값끼리 어긋나면 바깥 행성에서 T²/R³ 이 0.99 근처로 내려가
        "법칙이 안 맞는다"는 인상을 준다. 서로 맞는 자료로 정리했다. */
  const PLANETS = [
    { name: "수성",   a: 0.387,  T: 0.241 },
    { name: "금성",   a: 0.723,  T: 0.615 },
    { name: "지구",   a: 1.000,  T: 1.000 },
    { name: "화성",   a: 1.524,  T: 1.881 },
    { name: "목성",   a: 5.203,  T: 11.862 },
    { name: "토성",   a: 9.539,  T: 29.457 },
    { name: "천왕성", a: 19.18,  T: 84.011 },
    { name: "해왕성", a: 30.06,  T: 164.79 },
  ];

  const GASES = [
    { name: "수소 H₂",       molar: 0.002 },
    { name: "헬륨 He",       molar: 0.004 },
    { name: "질소 N₂",       molar: 0.028 },
    { name: "산소 O₂",       molar: 0.032 },
    { name: "이산화탄소 CO₂", molar: 0.044 },
  ];

  /* ---------------------------------------------------------
     상태
     --------------------------------------------------------- */
  const state = {
    bodyKey: "earth",
    M: 5.972e24,
    R: 6371e3,
    surfT: 288,
    atm: "N₂ 78% · O₂ 21%",

    h0: 0,            // 발사 높이(m)
    speedIdx: 500,    // 발사 속력 슬라이더 위치
    v0: 0,

    satH: 36000e3,    // 2단계 인공위성 높이(m)

    step: 1,
    running: false,
    playT: 0,         // 궤도 위 재생 시간(s)
    screenSec: 10,    // 한 바퀴에 걸리는 화면 시간

    showTicks: false,
    showTrails: true,
    showSector: true,
    showVel: true,
    showMarkers: true,

    traj: null,
    trails: [],
    records: [],
    orbitRecords: [],
  };

  const $ = (id) => document.getElementById(id);
  const canvas = $("simCanvas");
  const logCanvas = $("logCanvas");

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const fmt = (n, d = 2) => (isFinite(n) ? n.toFixed(d) : "–");

  function fmtKm(m) {
    let km = m / 1000;
    if (Math.abs(km) < 0.005) km = 0;   // -0.00 km 이 뜨지 않게
    if (km >= 100000) return `${Math.round(km).toLocaleString()} km`;
    if (km >= 1000) return `${fmt(km, 0)} km`;
    if (km >= 10) return `${fmt(km, 1)} km`;
    return `${fmt(km, 2)} km`;
  }
  function fmtSpeed(mps) { return `${fmt(mps / 1000, 3)} km/s`; }
  function fmtTime(s) {
    if (!isFinite(s) || s <= 0) return "–";
    if (s < 120) return `${fmt(s, 1)} 초`;
    if (s < 7200) return `${fmt(s / 60, 1)} 분`;
    if (s < 172800) return `${fmt(s / 3600, 2)} 시간`;
    return `${fmt(s / 86400, 2)} 일`;
  }

  const GM = () => G * state.M;
  const vCirc = (r) => Math.sqrt(GM() / r);
  const vEsc = (r) => Math.sqrt((2 * GM()) / r);
  const launchR = () => state.R + state.h0;

  /* ---------------------------------------------------------
     궤도 계산 — velocity Verlet
     주기는 "각을 2π 쓸고 지나간 시점"으로 직접 잰다.
     --------------------------------------------------------- */
  function computeTrajectory() {
    const gm = GM();
    const R = state.R;
    const r0 = launchR();
    const v0 = state.v0;

    let x = 0, y = r0, vx = v0, vy = 0;
    const eps = 0.5 * v0 * v0 - gm / r0;               // 비(比)에너지
    const Lz = x * vy - y * vx;                        // 비각운동량
    const semi = eps < 0 ? -gm / (2 * eps) : Infinity; // 긴반지름(해석값, 참고용)
    let ecc = 1;
    if (isFinite(semi)) {
      const inside = 1 + (2 * eps * Lz * Lz) / (gm * gm);
      ecc = Math.sqrt(Math.max(0, inside));
    }

    const bound = Math.max(r0 * 9, R * 11);
    const path = [];
    let t = 0, sweep = 0;
    let prevAng = Math.atan2(y, x);
    let rMin = r0, rMax = r0;
    let period = NaN;
    let fell = false, closed = false;

    for (let i = 0; i < MAX_STEPS; i++) {
      const r = Math.hypot(x, y);
      path.push({ x, y, t, v: Math.hypot(vx, vy), r });

      // 거리에 맞춰 간격을 조절한다 (멀리서는 성기게, 가까이서는 촘촘히)
      const dt = (DT_K * Math.pow(r, 1.5)) / Math.sqrt(gm);

      const k1 = -gm / (r * r * r);
      const ax1 = k1 * x, ay1 = k1 * y;
      x += vx * dt + 0.5 * ax1 * dt * dt;
      y += vy * dt + 0.5 * ay1 * dt * dt;
      const r2 = Math.hypot(x, y);
      const k2 = -gm / (r2 * r2 * r2);
      vx += 0.5 * (ax1 + k2 * x) * dt;
      vy += 0.5 * (ay1 + k2 * y) * dt;
      t += dt;

      // 지면 판정에 여유를 둔다. 지표면에서 정확히 궤도 속력으로 쏘면
      // 원 궤도가 지면을 스치는데, 적분 오차로 몇 m 파고들어 "추락"이 되어 버린다.
      if (i > 0 && r2 < R - R * 2e-5) {
        fell = true;
        path.push({ x, y, t, v: Math.hypot(vx, vy), r: r2 });
        break;
      }
      // 화면 밖으로 나가면 그리기를 멈춘다. 이것만으로 "탈출"이라고 판정하지는 않는다
      // (아주 길쭉한 타원도 여기까지 나갔다가 돌아온다).
      if (r2 > bound) break;

      rMin = Math.min(rMin, r2);
      rMax = Math.max(rMax, r2);

      const ang = Math.atan2(y, x);
      let d = ang - prevAng;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      sweep += d;
      prevAng = ang;

      if (Math.abs(sweep) >= TAU) {
        closed = true;
        period = t;
        path.push({ x, y, t, v: Math.hypot(vx, vy), r: r2 });
        break;
      }
    }

    // 궤도의 종류는 에너지 부호로 정한다 (속력 비교보다 정확하다).
    // 정확히 탈출 속도로 쏘면 에너지가 0인데, 부동소수점 오차로 음수가 되어
    // "타원"으로 갈리는 일이 있다. 그래서 아주 작은 여유를 둔다.
    const escTol = 1e-9 * (gm / r0);
    let outcome, kind;
    if (fell) { outcome = "fall"; kind = "fall"; }
    else if (eps >= -escTol) { outcome = "escape"; kind = "escape"; }
    else {
      outcome = "orbit";
      kind = ecc <= CIRCLE_TOL ? "circle" : "orbit";
    }

    // 잰 값으로 긴반지름을 구한다 (해석값을 쓰지 않는다)
    const measuredSemi = closed ? (rMin + rMax) / 2 : NaN;

    return {
      path, kind, outcome, closed, period, rMin, rMax,
      semi: measuredSemi, semiExact: semi, ecc, eps,
      total: path.length ? path[path.length - 1].t : 0,
    };
  }

  /** 케플러 2법칙 — 같은 시간 동안 쓸고 간 두 부채꼴 */
  function sectors(traj) {
    if (!traj.closed || !isFinite(traj.period)) return null;
    const p = traj.path;
    const span = traj.period / 10;

    let iMin = 0, iMax = 0;
    for (let i = 1; i < p.length; i++) {
      if (p[i].r < p[iMin].r) iMin = i;
      if (p[i].r > p[iMax].r) iMax = i;
    }

    const build = (start) => {
      const poly = [];
      let area = 0;
      const t0 = p[start].t;
      for (let i = start; i < p.length - 1; i++) {
        poly.push(p[i]);
        area += 0.5 * Math.abs(p[i].x * p[i + 1].y - p[i + 1].x * p[i].y);
        if (p[i + 1].t - t0 >= span) { poly.push(p[i + 1]); break; }
      }
      return { poly, area };
    };

    return { near: build(iMin), far: build(iMax), span };
  }

  /* ---------------------------------------------------------
     그리기 — 공용
     --------------------------------------------------------- */
  function drawGrid(ctx, w, h, halfSpan) {
    const pad = 14;
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

    ctx.fillStyle = COLOR_DIM;
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillText(`격자 ${Math.round(step / 1000).toLocaleString()} km`, 10, h - 10);
    ctx.restore();

    return { toPx: (x, y) => ({ px: cx + x * scale, py: cy - y * scale }), scale, cx, cy };
  }

  function drawCentralBody(ctx, g) {
    const rpx = state.R * g.scale;
    ctx.save();
    ctx.fillStyle = COLOR_BODY;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, rpx, 0, TAU); ctx.fill();
    ctx.strokeStyle = COLOR_BODY_RIM;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = COLOR_ATM;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, rpx + 3, 0, TAU); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = COLOR_MUTED;
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(currentBody().name, g.cx, g.cy + 4);
    ctx.restore();
  }

  function pathColor(kind) {
    if (kind === "fall") return COLOR_FALL;
    if (kind === "escape") return COLOR_ESCAPE;
    return COLOR_ORBIT;
  }

  function strokePath(ctx, g, pts, color, width, alpha) {
    if (!pts || pts.length < 2) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const q = g.toPx(pts[i].x, pts[i].y);
      if (i === 0) ctx.moveTo(q.px, q.py); else ctx.lineTo(q.px, q.py);
    }
    ctx.stroke();
    ctx.restore();
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

  /* ---------------------------------------------------------
     그리기 — 1·3단계 (궤도 무대)
     --------------------------------------------------------- */
  function viewSpanOrbit() {
    const tr = state.traj;
    const far = tr ? Math.max(tr.rMax, launchR()) : launchR();
    return Math.max(state.R * 1.45, far * 1.12);
  }

  function currentSample() {
    const tr = state.traj;
    if (!tr || !tr.path.length) return null;
    const p = tr.path;
    const T = tr.total;
    let t = state.playT;
    if (tr.closed) t = T > 0 ? state.playT % T : 0;
    else t = Math.min(state.playT, T);
    let lo = 0, hi = p.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (p[mid].t <= t) lo = mid; else hi = mid;
    }
    return p[lo];
  }

  function renderOrbitStage(ctx, w, h) {
    const g = drawGrid(ctx, w, h, viewSpanOrbit());
    lastG = g;   // 발사 화살표 드래그 판정에 쓴다

    if (state.showTrails) {
      state.trails.forEach((tr) => strokePath(ctx, g, tr.path, COLOR_TRAIL, 1.2, 0.85));
    }

    drawCentralBody(ctx, g);

    const tr = state.traj;
    if (!tr) return;

    strokePath(ctx, g, tr.path, pathColor(tr.kind), 2.2, 1);

    // 케플러 2법칙 부채꼴
    if (state.showSector && state.step === 3) {
      const sec = sectors(tr);
      if (sec) {
        [["near", COLOR_ORBIT], ["far", COLOR_ESCAPE]].forEach(([key, col]) => {
          const poly = sec[key].poly;
          if (poly.length < 2) return;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(g.cx, g.cy);
          poly.forEach((p) => { const q = g.toPx(p.x, p.y); ctx.lineTo(q.px, q.py); });
          ctx.closePath();
          ctx.fillStyle = col;
          ctx.globalAlpha = 0.3;
          ctx.fill();
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.restore();
        });
      }
    }

    // 근지점 · 원지점
    if (state.showMarkers && tr.closed) {
      let iMin = 0, iMax = 0;
      tr.path.forEach((p, i) => {
        if (p.r < tr.path[iMin].r) iMin = i;
        if (p.r > tr.path[iMax].r) iMax = i;
      });
      [[iMin, "근지점"], [iMax, "원지점"]].forEach(([i, txt]) => {
        const q = g.toPx(tr.path[i].x, tr.path[i].y);
        ctx.save();
        ctx.strokeStyle = COLOR_MARKER;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(q.px, q.py, 5.5, 0, TAU); ctx.stroke();
        ctx.restore();
        label(ctx, txt, q.px + 9, q.py + 4, COLOR_MARKER, 10);
      });
    }

    // 발사 지점과 속도 벡터
    const start = g.toPx(0, launchR());
    ctx.save();
    ctx.fillStyle = COLOR_MUTED;
    ctx.beginPath(); ctx.arc(start.px, start.py, 3.5, 0, TAU); ctx.fill();
    ctx.restore();
    const vk = velScale(g);
    arrowPx(ctx, start.px, start.py, start.px + state.v0 * vk, start.py, COLOR_INK, 2.2);
    label(ctx, "발사", start.px - 34, start.py - 8, COLOR_DIM, 10);

    // 움직이는 물체
    const s = currentSample();
    if (s) {
      const q = g.toPx(s.x, s.y);
      if (state.showVel && s.v > 0) {
        const idx = tr.path.indexOf(s);
        const nxt = tr.path[Math.min(idx + 1, tr.path.length - 1)];
        const dx = nxt.x - s.x, dy = nxt.y - s.y;
        const n = Math.hypot(dx, dy) || 1;
        const len = clamp(s.v * vk, 14, 120);
        arrowPx(ctx, q.px, q.py, q.px + (dx / n) * len, q.py - (dy / n) * len, COLOR_INK, 2);
      }
      ctx.save();
      ctx.fillStyle = pathColor(tr.kind);
      ctx.beginPath(); ctx.arc(q.px, q.py, 5.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  /** 발사 속도 화살표의 픽셀/(m/s) 환산 */
  function velScale(g) {
    const base = state.R * g.scale;
    return (0.9 * base) / (V_SPAN * vEsc(launchR()));
  }

  /* ---------------------------------------------------------
     그리기 — 2단계 (인공위성 원운동)
     --------------------------------------------------------- */
  function renderSatelliteStage(ctx, w, h) {
    const r = state.R + state.satH;
    const g = drawGrid(ctx, w, h, r * 1.3);
    drawCentralBody(ctx, g);

    const rpx = r * g.scale;
    ctx.save();
    ctx.strokeStyle = COLOR_ORBIT;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(g.cx, g.cy, rpx, 0, TAU); ctx.stroke();
    ctx.restore();

    const v = vCirc(r);
    const T = (TAU * r) / v;
    const ang = state.running || state.playT ? (state.playT / T) * TAU : 0;
    const px = g.cx + rpx * Math.cos(ang);
    const py = g.cy - rpx * Math.sin(ang);

    // 중력(= 구심력) 화살표
    const fLen = Math.min(rpx * 0.34, 92);
    const ux = (g.cx - px) / (rpx || 1), uy = (g.cy - py) / (rpx || 1);
    arrowPx(ctx, px, py, px + ux * fLen, py + uy * fLen, COLOR_ORBIT, 3);
    label(ctx, "중력 = 구심력", px + ux * fLen + 8, py + uy * fLen + 4, COLOR_ORBIT, 10);

    // 속도 화살표 (접선)
    const tx = -Math.sin(ang), ty = -Math.cos(ang);
    const vLen = Math.min(rpx * 0.3, 84);
    arrowPx(ctx, px, py, px + tx * vLen, py + ty * vLen, COLOR_INK, 2.2);
    label(ctx, "v", px + tx * vLen + 7, py + ty * vLen - 4, COLOR_INK, 12);

    ctx.save();
    ctx.fillStyle = COLOR_INK;
    ctx.beginPath(); ctx.arc(px, py, 5.5, 0, TAU); ctx.fill();
    ctx.restore();

    // 반지름 표시
    ctx.save();
    ctx.strokeStyle = COLOR_DIM;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(g.cx, g.cy); ctx.lineTo(px, py); ctx.stroke();
    ctx.restore();
    label(ctx, "r", (g.cx + px) / 2 + 6, (g.cy + py) / 2 + 4, COLOR_DIM, 11);
  }

  /* ---------------------------------------------------------
     그리기 — 4단계 (탈출 속도와 기체 분자 속력)
     --------------------------------------------------------- */
  function gasSpeed(molar) {
    return Math.sqrt((3 * R_GAS * state.surfT) / molar);
  }

  function renderGasStage(ctx, w, h) {
    ctx.fillStyle = COLOR_STAGE;
    ctx.fillRect(0, 0, w, h);

    const ve = vEsc(state.R);
    const speeds = GASES.map((gs) => gasSpeed(gs.molar));
    const top = Math.max(ve, ...speeds) * 1.15;

    const padL = 92, padR = 26, padT = 34, padB = 46;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const yOf = (v) => padT + plotH * (1 - v / top);

    ctx.save();
    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth = 1;
    ctx.fillStyle = COLOR_DIM;
    ctx.font = "10px 'JetBrains Mono', monospace";
    const stepV = SimUtils.niceStep(top / 1000, 6) * 1000;
    for (let v = 0; v <= top; v += stepV) {
      const y = Math.round(yOf(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillText(`${Math.round(v / 1000)}`, padL - 26, y + 4);
    }
    ctx.fillText("km/s", padL - 34, padT - 12);
    ctx.restore();

    // 기체 막대
    const bw = plotW / GASES.length;
    GASES.forEach((gs, i) => {
      const v = speeds[i];
      const x = padL + bw * i + bw * 0.24;
      const bwid = bw * 0.52;
      const y = yOf(v);
      const kept = ve >= RETAIN_FACTOR * v;
      ctx.save();
      ctx.fillStyle = kept ? COLOR_ORBIT : COLOR_FALL;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y, bwid, padT + plotH - y);
      ctx.restore();
      ctx.save();
      ctx.fillStyle = COLOR_MUTED;
      ctx.font = "10.5px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(gs.name.split(" ")[1] || gs.name, x + bwid / 2, h - 26);
      ctx.fillStyle = kept ? COLOR_ORBIT : COLOR_FALL;
      ctx.fillText(kept ? "붙잡음" : "날아감", x + bwid / 2, h - 12);
      ctx.restore();
    });

    // 기준선 두 개
    const drawLine = (v, color, text, dash) => {
      const y = yOf(v);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      if (dash) ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.restore();
      label(ctx, text, padL + 6, y - 6, color, 11);
    };
    if (ve <= top) drawLine(ve, COLOR_ESCAPE, `탈출 속도 ${fmt(ve / 1000, 2)} km/s (교과서 기준)`, false);
    drawLine(ve / RETAIN_FACTOR, COLOR_MARKER,
      `탈출 속도 ÷ ${RETAIN_FACTOR} = ${fmt(ve / RETAIN_FACTOR / 1000, 2)} km/s (실제 기준)`, true);

    label(ctx, `${currentBody().name} · 표면 온도 ${Math.round(state.surfT)} K`, padL, 18, COLOR_MUTED, 11);
  }

  /* ---------------------------------------------------------
     그리기 — 케플러 3법칙 로그 그래프
     --------------------------------------------------------- */
  function renderLogPlot() {
    if (!logCanvas || state.step !== 3) return;
    const { w, h, ctx } = SimUtils.fitCanvas(logCanvas);
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);

    const padL = 34, padR = 12, padT = 14, padB = 24;
    const x0 = -0.7, x1 = 1.7;   // log10(R³) 대신 log10(a)
    const y0 = -0.8, y1 = 2.4;   // log10(T)
    const X = (v) => padL + ((v - x0) / (x1 - x0)) * (w - padL - padR);
    const Y = (v) => h - padB - ((v - y0) / (y1 - y0)) * (h - padT - padB);

    ctx.save();
    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth = 1;
    for (let gx = Math.ceil(x0); gx <= x1; gx++) {
      const px = Math.round(X(gx)) + 0.5;
      ctx.beginPath(); ctx.moveTo(px, padT); ctx.lineTo(px, h - padB); ctx.stroke();
    }
    for (let gy = Math.ceil(y0); gy <= y1; gy++) {
      const py = Math.round(Y(gy)) + 0.5;
      ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(w - padR, py); ctx.stroke();
    }
    ctx.restore();

    // 기울기 3/2 직선 (T² = a³ → log T = 1.5 log a)
    ctx.save();
    ctx.strokeStyle = COLOR_ORBIT;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(X(x0), Y(1.5 * x0));
    ctx.lineTo(X(x1), Y(1.5 * x1));
    ctx.stroke();
    ctx.restore();

    PLANETS.forEach((p) => {
      const px = X(Math.log10(p.a));
      const py = Y(Math.log10(p.T));
      ctx.save();
      ctx.fillStyle = COLOR_INK;
      ctx.beginPath(); ctx.arc(px, py, 3.4, 0, TAU); ctx.fill();
      ctx.restore();
      label(ctx, p.name, px + 6, py + 3, COLOR_DIM, 9.5);
    });

    label(ctx, "log(긴반지름)", w - 84, h - 8, COLOR_DIM, 9.5);
    label(ctx, "log(주기)", 4, padT + 2, COLOR_DIM, 9.5);
    label(ctx, "기울기 3/2", X(1.05), Y(1.5 * 1.05) - 8, COLOR_ORBIT, 10);
  }

  /* ---------------------------------------------------------
     메인 렌더
     --------------------------------------------------------- */
  function render() {
    const { w, h, ctx } = SimUtils.fitCanvas(canvas);
    ctx.fillStyle = COLOR_STAGE;
    ctx.fillRect(0, 0, w, h);

    if (state.step === 2) renderSatelliteStage(ctx, w, h);
    else if (state.step === 4) renderGasStage(ctx, w, h);
    else renderOrbitStage(ctx, w, h);

    renderLogPlot();
    updateReadouts();
  }

  /* ---------------------------------------------------------
     판독
     --------------------------------------------------------- */
  const KIND_TEXT = {
    fall: "추락 — 지면에 부딪힌다",
    orbit: "타원 궤도 — 돌아온다",
    circle: "원 궤도 — 완전한 원",
    escape: "탈출 — 돌아오지 않는다",
  };

  function updateReadouts() {
    const body = currentBody();

    if (state.step === 1) {
      const tr = state.traj;
      const vd = $("orbitVerdict");
      vd.textContent = tr ? KIND_TEXT[tr.kind] : "–";
      vd.classList.toggle("is-fall", !!tr && tr.kind === "fall");
      vd.classList.toggle("is-escape", !!tr && tr.kind === "escape");

      $("ro1v0").textContent = fmtSpeed(state.v0);
      const s = currentSample();
      $("ro1vnow").textContent = s ? fmtSpeed(s.v) : "–";
      if (tr && tr.closed) {
        $("ro1peri").textContent = fmtKm(tr.rMin - state.R);
        $("ro1apo").textContent = fmtKm(tr.rMax - state.R);
        $("ro1T").textContent = fmtTime(tr.period);
      } else if (tr && tr.outcome === "orbit") {
        // 닫힌 궤도이지만 너무 길쭉해서 한 바퀴를 화면 안에서 못 돈 경우
        $("ro1peri").textContent = fmtKm(tr.rMin - state.R);
        $("ro1apo").textContent = "화면 밖";
        $("ro1T").textContent = "화면 밖";
      } else {
        $("ro1peri").textContent = "–";
        $("ro1apo").textContent = "–";
        $("ro1T").textContent = tr && tr.outcome === "escape" ? "돌아오지 않음" : "–";
      }
      return;
    }

    if (state.step === 2) {
      const r = state.R + state.satH;
      const v = vCirc(r);
      $("ro2r").textContent = fmtKm(r);
      $("ro2a").textContent = `${fmt(GM() / (r * r), 3)} m/s²`;
      $("ro2v").textContent = fmtSpeed(v);
      $("ro2T").textContent = fmtTime((TAU * r) / v);
      return;
    }

    if (state.step === 3) {
      const tr = state.traj;
      const sec = tr ? sectors(tr) : null;
      if (sec) {
        $("ro3areaP").textContent = `${fmt(sec.near.area / 1e12, 2)} ×10⁶ km²`;
        $("ro3areaA").textContent = `${fmt(sec.far.area / 1e12, 2)} ×10⁶ km²`;
        $("ro3areaRatio").textContent = fmt(sec.far.area / sec.near.area, 4);
      } else {
        $("ro3areaP").textContent = "–";
        $("ro3areaA").textContent = "–";
        $("ro3areaRatio").textContent = "닫힌 궤도에서만";
      }
      return;
    }

    // 4단계
    const ve = vEsc(state.R);
    $("ro4body").textContent = body.name;
    $("ro4vesc").textContent = ve >= C_LIGHT ? "빛보다 빠름 (블랙홀)" : fmtSpeed(ve);
    $("ro4temp").textContent = `${Math.round(state.surfT)} K`;
    $("ro4atm").textContent = state.atm;

    const rows = GASES.map((gs) => {
      const v = gasSpeed(gs.molar);
      const kept = ve >= RETAIN_FACTOR * v;
      return `<tr><td>${gs.name}</td><td>${fmt(v / 1000, 2)}</td>` +
             `<td style="color:${kept ? "#1ed760" : "#f3727f"}">${kept ? "붙잡음" : "날아감"}</td></tr>`;
    }).join("");
    $("gasTable").innerHTML =
      `<tr><th>기체</th><th>분자 속력<small>km/s</small></th><th>판정</th></tr>${rows}`;

    const keptNames = GASES.filter((gs) => ve >= RETAIN_FACTOR * gasSpeed(gs.molar))
      .map((gs) => gs.name.split(" ")[0]);
    $("gasNote").innerHTML = keptNames.length
      ? `이 천체가 붙잡을 수 있는 기체 — <b>${keptNames.join(" · ")}</b>. 실제 주요 대기와 비교해 보자.`
      : "붙잡을 수 있는 기체가 <b>없다.</b> 그래서 대기가 거의 없다.";
  }

  /* ---------------------------------------------------------
     표
     --------------------------------------------------------- */
  function buildPlanetTable() {
    const rows = PLANETS.map((p) => {
      const ratio = (p.T * p.T) / (p.a * p.a * p.a);
      return `<tr><td>${p.name}</td><td>${fmt(p.a, 3)}</td><td>${fmt(p.T, 3)}</td><td>${fmt(ratio, 4)}</td></tr>`;
    }).join("");
    $("planetTable").innerHTML =
      `<tr><th>행성</th><th>긴반지름<small>AU</small></th><th>주기<small>년</small></th><th>T²/R³</th></tr>${rows}`;
  }

  function refreshOrbitTable() {
    const t = $("orbitTable");
    t.classList.toggle("hidden", state.orbitRecords.length === 0);
    const rows = state.orbitRecords.map((rec, i) => {
      const measured = (rec.T * rec.T) / Math.pow(rec.a, 3);
      const theory = (TAU * TAU) / (G * rec.M);
      return `<tr class="is-mine"><td>${i + 1}</td><td>${fmt(rec.a / 1000, 0)}</td>` +
             `<td>${fmtTime(rec.T)}</td><td>${fmt(measured / theory, 4)}</td></tr>`;
    }).join("");
    t.innerHTML =
      `<tr><th>#</th><th>긴반지름<small>km</small></th><th>주기</th><th>4π²/GM 대비</th></tr>${rows}`;
  }

  const KIND_SHORT = { fall: "추락", orbit: "타원", circle: "원 궤도", escape: "탈출" };
  const KIND_CLASS = { fall: "k-fall", orbit: "k-orbit", circle: "k-orbit", escape: "k-escape" };

  function refreshRecTable() {
    const t = $("recTable");
    t.classList.toggle("hidden", state.records.length === 0);
    const rows = state.records.map((r) =>
      `<tr><td>${r.body}</td><td class="${KIND_CLASS[r.kind]}">${KIND_SHORT[r.kind]}</td>` +
      `<td>${fmt(r.v / 1000, 3)}</td></tr>`).join("");
    t.innerHTML = `<tr><th>천체</th><th>종류</th><th>속력<small>km/s</small></th></tr>${rows}`;

    // 같은 천체에서 「원 궤도」와 「탈출」을 모두 기록했으면 비를 보여준다
    const box = $("ratioHit");
    const hits = [];
    BODIES.forEach((b) => {
      const circ = state.records.filter((r) => r.body === b.name && r.kind === "circle");
      const esc = state.records.filter((r) => r.body === b.name && r.kind === "escape");
      if (circ.length && esc.length) {
        const vc = Math.min(...circ.map((r) => r.v));
        const veRec = Math.min(...esc.map((r) => r.v));
        hits.push(`${b.name} ${fmt(veRec / vc, 3)}`);
      }
    });
    box.classList.toggle("hidden", hits.length === 0);
    if (hits.length) {
      box.innerHTML = `탈출 ÷ 원 궤도 = ${hits.join(" · ")}<br>` +
        `천체가 달라도 값이 <b>√2 = 1.414</b> 근처다.`;
    }
  }

  /* ---------------------------------------------------------
     속력 막대 (구간 색 · 눈금)
     --------------------------------------------------------- */
  function speedTop() { return V_SPAN * vEsc(launchR()); }
  function speedFromIdx(idx) { return (clamp(idx, 0, SLIDER_STEPS) / SLIDER_STEPS) * speedTop(); }
  function idxFromSpeed(v) { return Math.round((clamp(v, 0, speedTop()) / speedTop()) * SLIDER_STEPS); }

  function updateTrack() {
    const on = state.showTicks;
    const zones = $("trackZones");
    const ticks = $("trackTicks");
    zones.classList.toggle("is-on", on);
    ticks.classList.toggle("is-on", on);
    if (!on) { zones.innerHTML = ""; ticks.innerHTML = ""; return; }

    const vc = vCirc(launchR());
    const ve = vEsc(launchR());
    const pc = (vc / speedTop()) * 100;
    const pe = (ve / speedTop()) * 100;
    zones.innerHTML =
      `<span style="left:0;width:${pc}%;background:#f3727f"></span>` +
      `<span style="left:${pc}%;width:${pe - pc}%;background:#1ed760"></span>` +
      `<span style="left:${pe}%;width:${100 - pe}%;background:#539df5"></span>`;
    ticks.innerHTML =
      `<span style="left:${pc}%">${fmt(vc / 1000, 2)}</span>` +
      `<span style="left:${pe}%">${fmt(ve / 1000, 2)}</span>`;
  }

  /* ---------------------------------------------------------
     범례 · 상태
     --------------------------------------------------------- */
  function updateLegend() {
    const line = (c, t) => `<div><i style="background:${c}"></i>${t}</div>`;
    let html = "";
    if (state.step === 2) {
      html += line(COLOR_ORBIT, "중력 = 구심력");
      html += line(COLOR_INK, "속도 v (접선)");
    } else if (state.step === 4) {
      html += line(COLOR_ORBIT, "붙잡히는 기체");
      html += line(COLOR_FALL, "날아가는 기체");
      html += line(COLOR_MARKER, `탈출 속도 ÷ ${RETAIN_FACTOR}`);
    } else {
      html += line(COLOR_FALL, "추락");
      html += line(COLOR_ORBIT, "닫힌 궤도 (원·타원)");
      html += line(COLOR_ESCAPE, "탈출");
      if (state.showMarkers) html += line(COLOR_MARKER, "근지점 · 원지점");
    }
    $("legend").innerHTML = html;
  }

  function updateStatus() {
    const tag = $("statusTag");
    if (state.step === 4) { tag.textContent = "기체 분자 속력 비교"; return; }
    if (state.step === 2) { tag.textContent = state.running ? "공전 중" : "인공위성"; return; }
    const tr = state.traj;
    tag.textContent = state.running ? "비행 중" : (tr ? KIND_TEXT[tr.kind] : "대기 중");
  }

  function updateStageHint() {
    const hint = $("stageHint");
    if (state.step === 1 || state.step === 3) hint.textContent = "발사 화살표 끝을 끌어도 속력이 바뀝니다";
    else hint.textContent = "";
  }

  /* ---------------------------------------------------------
     천체 · 값 갱신
     --------------------------------------------------------- */
  function currentBody() {
    const b = BODIES.find((x) => x.key === state.bodyKey);
    return b || { name: "사용자 천체", atm: "–" };
  }

  function applyBody(key) {
    const b = BODIES.find((x) => x.key === key);
    if (!b) return;
    state.bodyKey = key;
    state.M = b.M;
    state.R = b.R;
    state.surfT = b.T;
    state.atm = b.atm;
  }

  /** 슬라이더 눈금에 맞추지 않고 정확한 속력으로 발사한다 (「원 궤도로」 등) */
  function setSpeedExact(v) {
    state.v0 = v;
    state.speedIdx = idxFromSpeed(v);
    state.traj = computeTrajectory();
    state.playT = 0;
  }

  function recompute(keepSpeedRatio) {
    const ratio = keepSpeedRatio ? state.speedIdx / SLIDER_STEPS : null;
    if (ratio != null) state.v0 = ratio * speedTop();
    else state.v0 = speedFromIdx(state.speedIdx);
    state.traj = computeTrajectory();
    state.playT = 0;
  }

  /* ---------------------------------------------------------
     컨트롤 갱신
     --------------------------------------------------------- */
  function setNum(id, val, digits) {
    const el = $(id);
    if (!el || document.activeElement === el) return;
    el.value = val.toFixed(digits);
  }

  function updateControls() {
    $("speedInput").value = String(state.speedIdx);
    $("speedValue").textContent = fmtSpeed(state.v0);
    const tr = state.traj;
    const col = tr ? pathColor(tr.kind) : COLOR_ORBIT;
    $("speedValue").style.color = col;

    setNum("massValue", state.M / EARTH_M, 3);
    setNum("radiusValue", state.R / 1000, 0);
    setNum("h0Value", state.h0 / 1000, 0);
    setNum("hValue", state.satH / 1000, 0);
    $("hInput").value = String(idxFromH(state.satH));
    $("massInput").value = String(idxFromMass(state.M));
    $("radiusInput").value = String(idxFromRadius(state.R));
    $("h0Input").value = String(Math.round(state.h0 / 1000));
    $("bodySelect").value = state.bodyKey;
    updateTrack();
  }

  /* 로그 눈금 변환 */
  const logMap = (lo, hi) => ({
    from: (idx) => lo * Math.pow(hi / lo, clamp(idx, 0, SLIDER_STEPS) / SLIDER_STEPS),
    to: (v) => Math.round((Math.log(clamp(v, lo, hi) / lo) / Math.log(hi / lo)) * SLIDER_STEPS),
  });
  const H_MAP = logMap(100e3, 400000e3);
  const M_MAP = logMap(0.001 * EARTH_M, 500 * EARTH_M);
  const R_MAP = logMap(100e3, 200000e3);
  const hFromIdx = (i) => H_MAP.from(i), idxFromH = (v) => H_MAP.to(v);
  const massFromIdx = (i) => M_MAP.from(i), idxFromMass = (v) => M_MAP.to(v);
  const radiusFromIdx = (i) => R_MAP.from(i), idxFromRadius = (v) => R_MAP.to(v);

  /* ---------------------------------------------------------
     단계 전환
     --------------------------------------------------------- */
  function setStep(n) {
    state.step = n;
    state.playT = 0;
    document.querySelectorAll(".step-tab").forEach((b) =>
      b.classList.toggle("is-active", Number(b.dataset.step) === n));
    document.querySelectorAll(".step-pane").forEach((p) =>
      p.classList.toggle("is-active", Number(p.dataset.pane) === n));
    $("speedBar").classList.toggle("hidden", n === 2 || n === 4);
    updateLegend();
    updateStatus();
    updateStageHint();
    render();
  }

  /* ---------------------------------------------------------
     드래그 — 발사 화살표로 속력 조절
     --------------------------------------------------------- */
  let lastG = null, dragging = false;

  function canvasPos(e) {
    const b = canvas.getBoundingClientRect();
    return { mx: e.clientX - b.left, my: e.clientY - b.top };
  }

  function arrowTipPx() {
    if (!lastG) return null;
    const start = lastG.toPx(0, launchR());
    return { x: start.px + state.v0 * velScale(lastG), y: start.py, sx: start.px };
  }

  function bindDrag() {
    canvas.addEventListener("mousedown", (e) => {
      if (state.step === 2 || state.step === 4) return;
      const tip = arrowTipPx();
      if (!tip) return;
      const { mx, my } = canvasPos(e);
      if (Math.hypot(mx - tip.x, my - tip.y) > 15) return;
      e.preventDefault();
      dragging = true;
      state.running = false;
      updatePlayButtons();
      canvas.style.cursor = "grabbing";
    });

    canvas.addEventListener("mousemove", (e) => {
      if (dragging || state.step === 2 || state.step === 4) return;
      const tip = arrowTipPx();
      if (!tip) return;
      const { mx, my } = canvasPos(e);
      canvas.style.cursor = Math.hypot(mx - tip.x, my - tip.y) <= 15 ? "grab" : "default";
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging || !lastG) return;
      const { mx } = canvasPos(e);
      const start = lastG.toPx(0, launchR());
      const v = Math.max(0, (mx - start.px) / velScale(lastG));
      state.speedIdx = idxFromSpeed(v);
      recompute(false);
      updateControls();
      updateStatus();
      render();
    });

    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      canvas.style.cursor = "grab";
    });
  }

  /* ---------------------------------------------------------
     재생
     --------------------------------------------------------- */
  let lastTs = null;

  function updatePlayButtons() {
    $("playBtn").disabled = state.running;
    $("pauseBtn").disabled = !state.running;
  }

  function frame(ts) {
    if (state.running) {
      if (lastTs == null) lastTs = ts;
      const dtReal = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;

      if (state.step === 2) {
        const r = state.R + state.satH;
        const T = (TAU * r) / vCirc(r);
        state.playT += dtReal * (T / state.screenSec);
      } else if (state.traj) {
        const tr = state.traj;
        const span = tr.closed && isFinite(tr.period) ? tr.period : tr.total;
        state.playT += dtReal * (span / state.screenSec);
        if (!tr.closed && state.playT >= tr.total) {
          state.playT = tr.total;
          state.running = false;
          updatePlayButtons();
          updateStatus();
        }
      }
    } else {
      lastTs = ts;
    }
    render();
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------
     이벤트
     --------------------------------------------------------- */
  function bind() {
    $("playBtn").addEventListener("click", () => {
      if (state.traj && !state.traj.closed && state.playT >= state.traj.total) state.playT = 0;
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
      state.playT = 0;
      state.trails = [];
      updatePlayButtons();
      updateStatus();
      render();
    });

    $("settingsToggle").addEventListener("click", () => $("settingsOverlay").classList.remove("hidden"));
    $("settingsClose").addEventListener("click", () => $("settingsOverlay").classList.add("hidden"));
    $("settingsBackdrop").addEventListener("click", () => $("settingsOverlay").classList.add("hidden"));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") $("settingsOverlay").classList.add("hidden");
    });

    document.querySelectorAll(".step-tab").forEach((b) =>
      b.addEventListener("click", () => setStep(Number(b.dataset.step))));

    $("speedInput").addEventListener("input", (e) => {
      pushTrail();
      state.speedIdx = Number(e.target.value);
      recompute(false);
      updateControls();
      updateStatus();
      render();
    });

    $("snapCircle").addEventListener("click", () => {
      pushTrail();
      setSpeedExact(vCirc(launchR()));
      updateControls(); updateStatus(); render();
    });
    $("snapEscape").addEventListener("click", () => {
      pushTrail();
      setSpeedExact(vEsc(launchR()));
      updateControls(); updateStatus(); render();
    });

    $("showTicks").addEventListener("change", (e) => {
      state.showTicks = e.target.checked;
      updateTrack();
    });

    $("recordSpeed").addEventListener("click", () => {
      if (!state.traj) return;
      state.records.push({ body: currentBody().name, kind: state.traj.kind, v: state.v0 });
      refreshRecTable();
    });

    $("recordOrbit").addEventListener("click", () => {
      const tr = state.traj;
      if (!tr || !tr.closed || !isFinite(tr.period)) return;
      state.orbitRecords.push({ a: tr.semi, T: tr.period, M: state.M });
      refreshOrbitTable();
    });

    $("bodySelect").addEventListener("change", (e) => {
      applyBody(e.target.value);
      state.trails = [];
      recompute(true);
      updateControls(); updateLegend(); updateStatus(); render();
    });

    pairControl("massInput", "massValue", 3,
      (idx) => { state.M = massFromIdx(idx); },
      (val) => { state.M = clamp(val, 0.001, 500) * EARTH_M; });

    pairControl("radiusInput", "radiusValue", 0,
      (idx) => { state.R = radiusFromIdx(idx); },
      (val) => { state.R = clamp(val, 100, 200000) * 1000; });

    pairControl("hInput", "hValue", 0,
      (idx) => { state.satH = hFromIdx(idx); },
      (val) => { state.satH = clamp(val, 100, 400000) * 1000; });

    $("h0Input").addEventListener("input", (e) => {
      state.h0 = Number(e.target.value) * 1000;
      recompute(true);
      updateControls(); updateStatus(); render();
    });
    $("h0Value").addEventListener("change", (e) => {
      state.h0 = clamp(Number(e.target.value) || 0, 0, 2000) * 1000;
      e.target.blur();
      recompute(true);
      updateControls(); updateStatus(); render();
    });

    document.querySelectorAll("[data-h]").forEach((b) =>
      b.addEventListener("click", () => {
        state.satH = Number(b.dataset.h) * 1000;
        updateControls();
        render();
      }));

    $("rateSelect").addEventListener("change", (e) => { state.screenSec = Number(e.target.value); });

    [["showTrails", "showTrails"], ["showSector", "showSector"],
     ["showVel", "showVel"], ["showMarkers", "showMarkers"]].forEach(([id, key]) => {
      $(id).addEventListener("change", (e) => {
        state[key] = e.target.checked;
        updateLegend();
        render();
      });
    });

    bindDrag();
    window.addEventListener("resize", render);
  }

  /** 슬라이더 + 숫자 입력 한 쌍 */
  function pairControl(sliderId, numId, digits, fromIdx, fromNum) {
    const slider = $(sliderId), num = $(numId);
    const apply = (isNum, raw) => {
      const v = Number(raw);
      if (!isFinite(v)) { updateControls(); return; }
      if (isNum) { fromNum(v); num.blur(); } else fromIdx(v);
      if (isBodyChanged()) {
        state.bodyKey = "custom";
        state.atm = "–";
      }
      recompute(true);
      updateControls();
      updateStatus();
      render();
    };
    slider.addEventListener("input", (e) => apply(false, e.target.value));
    num.addEventListener("change", (e) => apply(true, e.target.value));
    num.addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
  }

  function isBodyChanged() {
    const b = BODIES.find((x) => x.key === state.bodyKey);
    if (!b) return true;
    return Math.abs(b.M - state.M) / b.M > 1e-6 || Math.abs(b.R - state.R) / b.R > 1e-6;
  }

  function pushTrail() {
    if (!state.showTrails || !state.traj) return;
    state.trails.push({ path: state.traj.path });
    if (state.trails.length > 8) state.trails.shift();
  }

  /* ---------------------------------------------------------
     시작
     --------------------------------------------------------- */
  function init() {
    $("bodySelect").innerHTML =
      BODIES.map((b) => `<option value="${b.key}">${b.name}</option>`).join("") +
      `<option value="custom">직접 설정</option>`;

    applyBody("earth");
    state.h0 = 0;
    state.speedIdx = idxFromSpeed(vCirc(launchR()) * 0.9);
    recompute(false);

    buildPlanetTable();
    refreshRecTable();
    refreshOrbitTable();

    bind();
    updateControls();
    updateLegend();
    updateStatus();
    updateStageHint();
    updatePlayButtons();
    setStep(1);
    requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
