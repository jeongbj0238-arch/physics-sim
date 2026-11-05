/* ============================================================
   전하와 전기장
   교과서: (동아출판) 전자기와 양자 pp.10~15 「01 전하와 전기장」, (미래엔) pp.10~13 「01 전기장」
   성취기준: [12전자01-01]

   1 전기력          두 전하 사이의 쿨롱 힘, 기준을 잡고 q·r을 바꿔 비로 비교
   2 전기장          같은 자리에서 q를 바꿔도 F/q는 그대로. 여러 전하는 벡터 합
   3 전기력선        전기장의 접선을 이은 선. 전하량이 크면 선이 많다
   4 전위와 등전위면 전위를 높이로 올린 곡면. 등고선 = 등전위선, 내리막 = 전기장
   5 해석하기        그림에서 세기·전위·방향·전하 종류를 추리. 정답은 그 자리에서 계산

   ※ 전기장·전위는 점전하의 합으로 계산한다. 그림은 전하가 놓인 평면의 단면이다.
   ※ 평행판은 4 m × 4 m 판 두 장을 점전하 400개씩으로 나눠 계산한다(가장자리가 휘는 것도 나온다).
   ※ 전기력선과 등전위선이 수직으로 보여야 하므로 x·y 축척을 같게 둔다.
      (다른 페이지의 독립 스케일링 drawSimGrid를 여기서는 쓰지 않는다.)
   ============================================================ */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // ---------- 상수 ----------
  const K = 9.0e9; // N·m²/C²
  const UC = 1e-6; // μC → C

  const LIM_X = 3.6, LIM_Y = 2.2;  // 전하를 놓을 수 있는 범위 (m)
  const BOX_X = 4, BOX_Y = 2.5;    // 3D 곡면의 범위 (m)
  const MAX_CHARGES = 6;

  const PLATE_X = 1, PLATE_HALF = 2, PLATE_N = 20, PLATE_Q = 3.6; // 판 위치·반폭(m), 한 변 점전하 수, 판 전체 전하(μC)

  const VCAP = 60000;      // 곡면을 자르는 전위 (V)
  const ZMAX = 2.2;        // VCAP의 높이 (m 단위의 그림 크기)
  const LEVEL_CAP = 30000; // 평면 그림의 등전위선 상한 (V)
  const NX = 96, NY = 60;  // 곡면 격자

  const E_ARROW = 120 / 18000; // 전기장 화살표 px / (N/C)
  const F_ARROW = 100 / 0.01;  // 탭 1의 힘 화살표 px / N
  const GRID_CAP = 0.42;       // 격자 화살표 최대 길이 (m)
  const GRID_SCALE = GRID_CAP / 18000;

  const COLOR_PLUS = "#dc2626";
  const COLOR_MINUS = "#2563eb";
  const COLOR_E = "#171717";
  const COLOR_F = "#e5620a";
  const COLOR_LINE = "#4d4d4d";
  const COLOR_EQ = "#0d9488";
  const COLOR_TEST = "#16a34a";
  const COLOR_GRID = "#ebebeb";
  const COLOR_SOFT = "#8f8f8f";
  const COLOR_OK = "#16a34a";
  const COLOR_NO = "#dc2626";
  const FONT = "Geist, -apple-system, 'Segoe UI', 'Malgun Gothic', sans-serif";
  const MONO = "'Geist Mono', ui-monospace, 'Malgun Gothic', monospace";

  const PRESETS = {
    plus: () => [{ x: 0, y: 0, Q: 2 }],
    minus: () => [{ x: 0, y: 0, Q: -2 }],
    dipole: () => [{ x: -1.5, y: 0, Q: 2 }, { x: 1.5, y: 0, Q: -2 }],
    same: () => [{ x: -1.5, y: 0, Q: 2 }, { x: 1.5, y: 0, Q: 2 }],
    plate: () => [],
  };

  const PLATE_SOURCES = (() => {
    const out = [];
    const step = (2 * PLATE_HALF) / PLATE_N;
    const q = PLATE_Q / (PLATE_N * PLATE_N);
    for (let i = 0; i < PLATE_N; i++) {
      for (let j = 0; j < PLATE_N; j++) {
        const y = -PLATE_HALF + (i + 0.5) * step;
        const z = -PLATE_HALF + (j + 0.5) * step;
        out.push({ x: -PLATE_X, y, z, q });
        out.push({ x: PLATE_X, y, z, q: -q });
      }
    }
    return out;
  })();

  // ---------- 상태 ----------
  function freshState() {
    return {
      tab: 1,
      t1: { Q: 2, q: 1, angle: 0, r: 2, base: null },
      field: { preset: "plus", charges: PRESETS.plus(), sel: 0 },
      test: { x: 1.1, y: 0.9, q: 1, on: true },
      showGrid: true,
      showParts: false,
      showArrows: true,
      showEq: false,
      density: 6,
      probe: { x: 1.1, y: 0.9 },
      yaw: -0.55,
      el: (35 * Math.PI) / 180,
      contours3d: true,
      lines3d: true,
      hgt: 1,
      zoom: 1,
      dv: 5000,
      quiz: null,
      score: { right: 0, total: 0 },
    };
  }
  let state = freshState();

  let canvas, cardEls;
  let sources = [];
  let plateOn = false;
  let view = { w: 1, h: 1, ppm: 100, hx: 4, hy: 2.5 };
  let cache = { lines: null, contours: null, surface: null, arrows: null };
  let proj3d = null; // 마지막으로 그린 곡면의 화면 좌표 (점 찍기용)
  let drag = null;

  // ---------- 전기장·전위 ----------
  let Fx = 0, Fy = 0, Fv = 0;

  function field(x, y) {
    let ex = 0, ey = 0, v = 0;
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      const dx = x - s.x, dy = y - s.y;
      let r2 = dx * dx + dy * dy + s.z * s.z;
      if (r2 < 1e-4) r2 = 1e-4;
      const r = Math.sqrt(r2);
      const kq = K * s.q * UC;
      const c = kq / (r2 * r);
      ex += c * dx;
      ey += c * dy;
      v += kq / r;
    }
    Fx = ex; Fy = ey; Fv = v;
  }

  function fieldInfo(x, y) {
    field(x, y);
    return { ex: Fx, ey: Fy, E: Math.hypot(Fx, Fy), V: Fv };
  }

  function activeConfig() {
    return state.tab === 5 && state.quiz ? state.quiz.cfg : state.field;
  }

  function rebuildSources() {
    const cfg = activeConfig();
    plateOn = cfg.preset === "plate";
    sources = plateOn ? PLATE_SOURCES : cfg.charges.map((c) => ({ x: c.x, y: c.y, z: 0, q: c.Q }));
    invalidate();
  }

  function invalidate() {
    cache = { lines: null, contours: null, surface: null, arrows: null };
  }

  // ---------- 숫자 표시 ----------
  function sig3(v) {
    if (!isFinite(v)) return "–";
    if (v === 0) return "0";
    const sign = v < 0 ? "−" : "";
    const a = Math.abs(v);
    if (a >= 1000) {
      const mag = Math.pow(10, Math.floor(Math.log10(a)) - 2);
      return sign + (Math.round(a / mag) * mag).toLocaleString("en-US");
    }
    return sign + String(Number(a.toPrecision(3)));
  }
  const signed = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v);
  const degOf = (ex, ey) => {
    let d = (Math.atan2(ey, ex) * 180) / Math.PI;
    if (d < 0) d += 360;
    return Math.round(d) % 360;
  };

  // ---------- 2D 좌표 ----------
  function updateView() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    const ppm = Math.min(w / 8.4, h / 5.4);
    const changed = Math.abs(ppm - view.ppm) > 1e-6 || w !== view.w || h !== view.h;
    view = { w, h, ppm, hx: w / 2 / ppm, hy: h / 2 / ppm };
    if (changed) invalidate();
  }
  const toX = (x) => view.w / 2 + x * view.ppm;
  const toY = (y) => view.h / 2 - y * view.ppm;
  const fromX = (px) => (px - view.w / 2) / view.ppm;
  const fromY = (py) => (view.h / 2 - py) / view.ppm;

  // ---------- 그리기 도구 ----------
  function arrow(ctx, x1, y1, x2, y2, color, width, head) {
    const L = Math.hypot(x2 - x1, y2 - y1);
    if (L < 0.5) return;
    const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    const hd = Math.min(head, L * 0.7);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - ux * hd * 0.7, y2 - uy * hd * 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * hd - uy * hd * 0.5, y2 - uy * hd + ux * hd * 0.5);
    ctx.lineTo(x2 - ux * hd + uy * hd * 0.5, y2 - uy * hd - ux * hd * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 화면보다 긴 값은 cap에서 자르고 촉을 두 겹으로 그려 잘렸음을 알린다.
  function cappedArrow(ctx, x, y, ux, uy, len, cap, color, width) {
    const L = Math.min(len, cap);
    arrow(ctx, x, y, x + ux * L, y + uy * L, color, width, 11);
    if (len > cap) arrow(ctx, x, y, x + ux * (L - 9), y + uy * (L - 9), color, width, 11);
  }

  function label(ctx, text, x, y, color, opt = {}) {
    ctx.save();
    ctx.font = opt.font || `500 12px ${MONO}`;
    ctx.textAlign = opt.align || "left";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(text).width;
    if (opt.bg !== false) {
      const left = opt.align === "center" ? x - tw / 2 : opt.align === "right" ? x - tw : x;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(left - 3, y - 8, tw + 6, 16);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawCharge(ctx, px, py, Q, opt = {}) {
    const R = 11 + Math.abs(Q) * 1.6;
    const hidden = opt.hidden;
    ctx.save();
    if (opt.selected) {
      ctx.strokeStyle = COLOR_E;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(px, py, R + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = hidden ? COLOR_SOFT : Q > 0 ? COLOR_PLUS : COLOR_MINUS;
    ctx.beginPath();
    ctx.arc(px, py, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 ${Math.round(R * 1.2)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(hidden ? "?" : Q > 0 ? "+" : "−", px, py + 1);
    ctx.restore();
    if (opt.text) label(ctx, opt.text, px, py + R + 12, COLOR_SOFT, { align: "center" });
  }

  function drawPlateBars(ctx, opt = {}) {
    [{ x: -PLATE_X, color: COLOR_PLUS, ch: "+" }, { x: PLATE_X, color: COLOR_MINUS, ch: "−" }].forEach((p) => {
      const color = opt.hidden ? COLOR_SOFT : p.color;
      ctx.fillStyle = color;
      ctx.fillRect(toX(p.x) - 3, toY(PLATE_HALF), 6, 2 * PLATE_HALF * view.ppm);
      if (opt.hidden) return;
      ctx.fillStyle = "#ffffff";
      ctx.font = `600 10px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let y = -1.75; y <= 1.76; y += 0.5) ctx.fillText(p.ch, toX(p.x), toY(y));
    });
  }

  function drawGridBg(ctx) {
    const { w, h } = view;
    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.ceil(-view.hx); x <= view.hx; x++) {
      ctx.moveTo(toX(x), 0);
      ctx.lineTo(toX(x), h);
    }
    for (let y = Math.ceil(-view.hy); y <= view.hy; y++) {
      ctx.moveTo(0, toY(y));
      ctx.lineTo(w, toY(y));
    }
    ctx.stroke();
    // 축척 막대 1 m
    const bx = 14, by = h - 16;
    ctx.strokeStyle = COLOR_SOFT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + view.ppm, by);
    ctx.stroke();
    label(ctx, "1 m", bx + view.ppm + 6, by, COLOR_SOFT, { bg: false, font: `11px ${MONO}` });
  }

  // ---------- 전기력선 ----------
  function traceLine(x0, y0, dir, bx, by) {
    const h = 0.03;
    const pts = [[x0, y0]];
    let x = x0, y = y0, end = null;
    const cfg = activeConfig();
    for (let i = 0; i < 1500; i++) {
      field(x, y);
      let m = Math.hypot(Fx, Fy);
      if (m < 1) break;
      const mx = x + (dir * h * 0.5 * Fx) / m, my = y + (dir * h * 0.5 * Fy) / m;
      field(mx, my);
      m = Math.hypot(Fx, Fy);
      if (m < 1) break;
      x += (dir * h * Fx) / m;
      y += (dir * h * Fy) / m;
      pts.push([x, y]);
      if (Math.abs(x) > bx || Math.abs(y) > by) break;
      if (plateOn) {
        const target = dir > 0 ? PLATE_X : -PLATE_X;
        if (Math.abs(x - target) < 0.06 && Math.abs(y) <= PLATE_HALF) { end = "plate"; break; }
      } else {
        let hit = false;
        for (const c of cfg.charges) {
          if (c.Q * dir < 0 && Math.hypot(x - c.x, y - c.y) < 0.1) {
            pts.push([c.x, c.y]);
            end = c;
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
    }
    return { pts, end };
  }

  function linesOf(Q) {
    const d = state.tab === 5 ? 6 : state.density;
    return Math.max(2, Math.round(Math.abs(Q) * d));
  }

  function getLines() {
    if (cache.lines) return cache.lines;
    const bx = Math.max(view.hx, BOX_X) + 0.3, by = Math.max(view.hy, BOX_Y) + 0.3;
    const lines = [];
    if (plateOn) {
      const d = state.tab === 5 ? 6 : state.density;
      const n = Math.max(5, Math.round(d * 1.5));
      for (let i = 0; i < n; i++) {
        const y = -PLATE_HALF * 0.9 + (i * 1.8 * PLATE_HALF) / (n - 1);
        lines.push(traceLine(-PLATE_X + 0.08, y, 1, bx, by).pts);
      }
      [-1.5, -0.5, 0.5, 1.5].forEach((y) => lines.push(traceLine(-PLATE_X - 0.08, y, 1, bx, by).pts));
    } else {
      const charges = activeConfig().charges;
      charges.forEach((c) => {
        if (c.Q <= 0) return;
        const n = linesOf(c.Q);
        for (let i = 0; i < n; i++) {
          const a = ((i + 0.5) * 2 * Math.PI) / n;
          lines.push(traceLine(c.x + 0.12 * Math.cos(a), c.y + 0.12 * Math.sin(a), 1, bx, by).pts);
        }
      });
      // 음전하로 들어오는 선 중 양전하에서 출발하지 않은 것(먼 곳에서 오는 선)만 더한다.
      charges.forEach((c) => {
        if (c.Q >= 0) return;
        const n = linesOf(c.Q);
        for (let i = 0; i < n; i++) {
          const a = ((i + 0.5) * 2 * Math.PI) / n;
          const t = traceLine(c.x + 0.12 * Math.cos(a), c.y + 0.12 * Math.sin(a), -1, bx, by);
          if (!t.end) lines.push(t.pts.reverse());
        }
      });
    }
    cache.lines = lines;
    return lines;
  }

  function drawLines(ctx, withArrows) {
    const lines = getLines();
    ctx.save();
    ctx.strokeStyle = COLOR_LINE;
    ctx.lineWidth = 1.3;
    ctx.lineJoin = "round";
    lines.forEach((pts) => {
      ctx.beginPath();
      pts.forEach((p, i) => {
        if (i === 0) ctx.moveTo(toX(p[0]), toY(p[1]));
        else ctx.lineTo(toX(p[0]), toY(p[1]));
      });
      ctx.stroke();
    });
    ctx.restore();
    if (!withArrows) return;
    lines.forEach((pts) => {
      let s = 0, next = 0.75;
      for (let i = 1; i < pts.length - 1; i++) {
        s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        if (s >= next) {
          const px = toX(pts[i][0]), py = toY(pts[i][1]);
          if (px > 0 && px < view.w && py > 0 && py < view.h) {
            const q = pts[i + 1];
            const a = Math.atan2(toY(q[1]) - py, toX(q[0]) - px);
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(a);
            ctx.fillStyle = COLOR_LINE;
            ctx.beginPath();
            ctx.moveTo(6, 0);
            ctx.lineTo(-4, 3.6);
            ctx.lineTo(-4, -3.6);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
          next += 1.5;
        }
      }
    });
  }

  // ---------- 등전위선 (평면) ----------
  function getContours() {
    if (cache.contours && cache.contours.dv === state.dv) return cache.contours;
    const hx = view.hx + 0.2, hy = view.hy + 0.2;
    const step = plateOn ? 0.08 : 0.05;
    const nx = Math.ceil((2 * hx) / step), ny = Math.ceil((2 * hy) / step);
    const vals = new Float64Array((nx + 1) * (ny + 1));
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        field(-hx + i * step, -hy + j * step);
        vals[j * (nx + 1) + i] = Fv;
      }
    }
    const dv = state.dv;
    const segs = [];
    const best = new Map(); // 값마다 라벨 자리: 화면 안에서 가장 위쪽 선분
    const cross = (a, b, L) => (a < L) !== (b < L);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const v00 = vals[j * (nx + 1) + i], v10 = vals[j * (nx + 1) + i + 1];
        const v01 = vals[(j + 1) * (nx + 1) + i], v11 = vals[(j + 1) * (nx + 1) + i + 1];
        const lo = Math.min(v00, v10, v01, v11), hi = Math.max(v00, v10, v01, v11);
        const k0 = Math.max(Math.ceil(lo / dv), -Math.floor(LEVEL_CAP / dv));
        const k1 = Math.min(Math.floor(hi / dv), Math.floor(LEVEL_CAP / dv));
        if (k1 < k0) continue;
        const x0 = -hx + i * step, y0 = -hy + j * step;
        for (let k = k0; k <= k1; k++) {
          const L = k * dv;
          const pts = [];
          if (cross(v00, v10, L)) pts.push([x0 + (step * (L - v00)) / (v10 - v00), y0]);
          if (cross(v10, v11, L)) pts.push([x0 + step, y0 + (step * (L - v10)) / (v11 - v10)]);
          if (cross(v01, v11, L)) pts.push([x0 + (step * (L - v01)) / (v11 - v01), y0 + step]);
          if (cross(v00, v01, L)) pts.push([x0, y0 + (step * (L - v00)) / (v01 - v00)]);
          for (let p = 0; p + 1 < pts.length; p += 2) {
            segs.push(pts[p][0], pts[p][1], pts[p + 1][0], pts[p + 1][1]);
            const my = pts[p][1], mx = pts[p][0];
            if (Math.abs(mx) < view.hx - 0.5 && my < view.hy - 0.35) {
              const b = best.get(L);
              if (!b || my > b.y) best.set(L, { x: mx, y: my });
            }
          }
        }
      }
    }
    cache.contours = { segs, best, dv };
    return cache.contours;
  }

  function drawContours(ctx, withLabels) {
    const c = getContours();
    ctx.save();
    ctx.strokeStyle = COLOR_EQ;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (let i = 0; i < c.segs.length; i += 4) {
      ctx.moveTo(toX(c.segs[i]), toY(c.segs[i + 1]));
      ctx.lineTo(toX(c.segs[i + 2]), toY(c.segs[i + 3]));
    }
    ctx.stroke();
    ctx.restore();
    if (!withLabels) return;
    // 전하 가까이는 선이 촘촘해 글자가 겹친다 — 바깥쪽 세 값까지만 적는다
    c.best.forEach((p, L) => {
      if (Math.abs(L) > 3 * c.dv) return;
      label(ctx, L === 0 ? "0 V" : `${L < 0 ? "−" : ""}${Math.abs(L) / 1000} kV`, toX(p.x), toY(p.y), COLOR_EQ, { align: "center", font: `500 11px ${MONO}` });
    });
  }

  // ---------- 화살표 격자 ----------
  function getArrows() {
    if (cache.arrows) return cache.arrows;
    const out = [];
    const gap = 0.5;
    for (let x = -Math.floor(view.hx / gap) * gap; x <= view.hx; x += gap) {
      for (let y = -Math.floor(view.hy / gap) * gap; y <= view.hy; y += gap) {
        if (!plateOn && activeConfig().charges.some((c) => Math.hypot(x - c.x, y - c.y) < 0.3)) continue;
        const f = fieldInfo(x, y);
        if (f.E < 1) continue;
        out.push({ x, y, ux: f.ex / f.E, uy: f.ey / f.E, L: Math.min(GRID_CAP, f.E * GRID_SCALE) });
      }
    }
    cache.arrows = out;
    return out;
  }

  function drawArrowGrid(ctx) {
    getArrows().forEach((a) => {
      const L = a.L * view.ppm;
      const x = toX(a.x), y = toY(a.y);
      arrow(ctx, x - (a.ux * L) / 2, y + (a.uy * L) / 2, x + (a.ux * L) / 2, y - (a.uy * L) / 2, "#a1a1a1", 1.2, 6);
    });
  }

  function drawSources(ctx, opt = {}) {
    if (plateOn) {
      drawPlateBars(ctx, opt);
      return;
    }
    const cfg = activeConfig();
    cfg.charges.forEach((c, i) => {
      drawCharge(ctx, toX(c.x), toY(c.y), c.Q, {
        selected: opt.select && i === cfg.sel,
        hidden: opt.hidden,
        text: opt.hidden ? "" : `${signed(c.Q)} μC`,
      });
    });
  }

  // ---------- 탭 1 전기력 ----------
  function t1Force() {
    const t = state.t1;
    const F = (K * Math.abs(t.Q * UC * t.q * UC)) / (t.r * t.r);
    return { F, repel: t.Q * t.q > 0 };
  }
  const T1_Q = { x: -2, y: 0 };

  function renderTab1(ctx) {
    drawGridBg(ctx);
    const t = state.t1;
    const qx = T1_Q.x + t.r * Math.cos(t.angle), qy = T1_Q.y + t.r * Math.sin(t.angle);
    const px0 = toX(T1_Q.x), py0 = toY(T1_Q.y), px1 = toX(qx), py1 = toY(qy);
    const { F, repel } = t1Force();

    // 거리
    const ux = (px1 - px0) / (t.r * view.ppm), uy = (py1 - py0) / (t.r * view.ppm);
    ctx.save();
    ctx.strokeStyle = COLOR_SOFT;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px0, py0);
    ctx.lineTo(px1, py1);
    ctx.stroke();
    ctx.restore();
    label(ctx, `r = ${t.r.toFixed(1)} m`, (px0 + px1) / 2 - uy * 16, (py0 + py1) / 2 + ux * 16, COLOR_SOFT, { align: "center" });

    // 작용 반작용: 두 전하가 같은 크기의 힘을 반대 방향으로 받는다
    const len = F * F_ARROW, cap = Math.min(view.w, view.h) * 0.42;
    const dir = repel ? 1 : -1;
    const r0 = 11 + Math.abs(t.Q) * 1.6, r1 = 11 + Math.abs(t.q) * 1.6;
    cappedArrow(ctx, px1 + ux * dir * r1, py1 + uy * dir * r1, ux * dir, uy * dir, len, cap, COLOR_F, 3.5);
    cappedArrow(ctx, px0 - ux * dir * r0, py0 - uy * dir * r0, -ux * dir, -uy * dir, len, cap, COLOR_F, 3.5);

    drawCharge(ctx, px0, py0, t.Q, { text: `Q = ${signed(t.Q)} μC` });
    drawCharge(ctx, px1, py1, t.q, { text: `q = ${signed(t.q)} μC` });

    drawForceGraph(ctx);
  }

  // F–r 작은 그래프 (거리 제곱에 반비례하는 곡선)
  function drawForceGraph(ctx) {
    const t = state.t1;
    const gw = 230, gh = 130;
    const gx = view.w - gw - 18, gy = 16;
    const plotL = gx + 44, plotR = gx + gw - 10, plotT = gy + 22, plotB = gy + gh - 22;
    const rMax = 6, rMin = 0.5;
    const kqq = K * Math.abs(t.Q * UC * t.q * UC);
    const fTop = kqq / (rMin * 2 * (rMin * 2)); // r = 1 m일 때의 힘을 맨 위로
    const xOf = (r) => plotL + ((r - 0) / rMax) * (plotR - plotL);
    const yOf = (f) => plotB - Math.min(1.02, f / fTop) * (plotB - plotT);

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(gx, gy, gw, gh);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = COLOR_SOFT;
    ctx.beginPath();
    ctx.moveTo(plotL, plotT);
    ctx.lineTo(plotL, plotB);
    ctx.lineTo(plotR, plotB);
    ctx.stroke();

    ctx.strokeStyle = COLOR_F;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    let started = false;
    for (let r = 0.5; r <= rMax; r += 0.05) {
      const f = kqq / (r * r);
      if (f > fTop * 1.02) continue;
      if (!started) { ctx.moveTo(xOf(r), yOf(f)); started = true; } else ctx.lineTo(xOf(r), yOf(f));
    }
    ctx.stroke();

    if (t.base && t.base.Qq === Math.abs(t.Q * t.q)) {
      ctx.fillStyle = COLOR_SOFT;
      ctx.beginPath();
      ctx.arc(xOf(t.base.r), yOf(t.base.F), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const f = kqq / (t.r * t.r);
    ctx.fillStyle = COLOR_F;
    ctx.beginPath();
    ctx.arc(xOf(t.r), yOf(f), 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    label(ctx, "F", gx + 12, plotT + 2, COLOR_SOFT, { bg: false, font: `11px ${MONO}` });
    label(ctx, sig3(fTop) + " N", plotL + 4, plotT - 9, COLOR_SOFT, { bg: false, font: `10px ${MONO}` });
    label(ctx, "r (m)", plotR, plotB + 11, COLOR_SOFT, { bg: false, align: "right", font: `11px ${MONO}` });
    [1, 2, 4].forEach((r) => label(ctx, String(r), xOf(r), plotB + 11, COLOR_SOFT, { bg: false, align: "center", font: `10px ${MONO}` }));
  }

  // ---------- 탭 2 전기장 ----------
  function renderTab2(ctx) {
    drawGridBg(ctx);
    if (state.showGrid) drawArrowGrid(ctx);
    drawSources(ctx, { select: true });

    const t = state.test;
    const f = fieldInfo(t.x, t.y);
    const px = toX(t.x), py = toY(t.y);
    if (f.E > 0) {
      const ux = f.ex / f.E, uy = -f.ey / f.E;
      if (state.showParts && !plateOn) drawParts(ctx, t, f);
      if (t.on) {
        const sgn = t.q > 0 ? 1 : -1;
        cappedArrow(ctx, px - uy * 8 * sgn, py + ux * 8 * sgn, ux * sgn, uy * sgn, f.E * Math.abs(t.q) * E_ARROW, 300, COLOR_F, 3.5);
        const L = Math.min(f.E * Math.abs(t.q) * E_ARROW, 300);
        label(ctx, "F", px - uy * 8 * sgn + ux * sgn * (L + 12), py + ux * 8 * sgn + uy * sgn * (L + 12), COLOR_F, { align: "center", font: `600 13px ${MONO}` });
      }
      cappedArrow(ctx, px, py, ux, uy, f.E * E_ARROW, 240, COLOR_E, 3);
      const L = Math.min(f.E * E_ARROW, 240);
      label(ctx, "E", px + ux * (L + 12), py + uy * (L + 12), COLOR_E, { align: "center", font: `600 13px ${MONO}` });
    }
    if (t.on) {
      ctx.fillStyle = COLOR_TEST;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      label(ctx, t.q > 0 ? "+" : "−", px, py + 0.5, "#ffffff", { align: "center", bg: false, font: `600 12px ${FONT}` });
    } else {
      ctx.strokeStyle = COLOR_E;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // 전하별 전기장과 벡터 합
  function drawParts(ctx, t, f) {
    const cfg = state.field;
    const px = toX(t.x), py = toY(t.y);
    const tips = [];
    cfg.charges.forEach((c) => {
      const dx = t.x - c.x, dy = t.y - c.y;
      const r2 = Math.max(dx * dx + dy * dy, 1e-4), r = Math.sqrt(r2);
      const e = (K * c.Q * UC) / r2;
      const ex = (e * dx) / r, ey = (e * dy) / r;
      const tipX = px + ex * E_ARROW, tipY = py - ey * E_ARROW;
      tips.push([tipX, tipY]);
      arrow(ctx, px, py, tipX, tipY, c.Q > 0 ? COLOR_PLUS : COLOR_MINUS, 2, 9);
    });
    if (tips.length === 2) {
      const sx = px + f.ex * E_ARROW, sy = py - f.ey * E_ARROW;
      ctx.save();
      ctx.strokeStyle = COLOR_SOFT;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tips[0][0], tips[0][1]);
      ctx.lineTo(sx, sy);
      ctx.lineTo(tips[1][0], tips[1][1]);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---------- 탭 3 전기력선 ----------
  function renderTab3(ctx) {
    drawGridBg(ctx);
    if (state.showEq) drawContours(ctx, true);
    drawLines(ctx, state.showArrows);
    drawSources(ctx, { select: true });
    const p = state.probe;
    const f = fieldInfo(p.x, p.y);
    const px = toX(p.x), py = toY(p.y);
    if (f.E > 0) cappedArrow(ctx, px, py, f.ex / f.E, -f.ey / f.E, f.E * E_ARROW, 240, COLOR_F, 3);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = COLOR_F;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // ---------- 탭 4 전위 곡면 ----------
  function getSurface() {
    if (cache.surface && cache.surface.dv === state.dv) return cache.surface;
    const n = (NX + 1) * (NY + 1);
    const X = new Float64Array(n), Y = new Float64Array(n), V = new Float64Array(n);
    const id = (i, j) => j * (NX + 1) + i;
    for (let j = 0; j <= NY; j++) {
      for (let i = 0; i <= NX; i++) {
        const x = -BOX_X + (i * 2 * BOX_X) / NX, y = -BOX_Y + (j * 2 * BOX_Y) / NY;
        field(x, y);
        const k = id(i, j);
        X[k] = x; Y[k] = y; V[k] = Fv;
      }
    }
    const dv = state.dv;
    const clip = (v) => Math.max(-VCAP, Math.min(VCAP, v));
    const quads = [];
    const dx = (2 * BOX_X) / NX, dy = (2 * BOX_Y) / NY;
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
        const va = V[a], vb = V[b], vc = V[c], vd = V[d];
        const avg = (clip(va) + clip(vb) + clip(vc) + clip(vd)) / 4;
        // 색: 전위에 따라 빨강(+)·파랑(−), 기울기로 명암
        const gx = ((clip(vb) + clip(vc) - clip(va) - clip(vd)) / (2 * dx)) * (ZMAX / VCAP);
        const gy = ((clip(vc) + clip(vd) - clip(va) - clip(vb)) / (2 * dy)) * (ZMAX / VCAP);
        const nl = Math.hypot(gx, gy, 1);
        const shade = 0.8 + 0.2 * Math.max(0, (0.4 * gx + 0.5 * gy + 0.77) / nl);
        const t = Math.pow(Math.min(1, Math.abs(avg) / VCAP), 0.55);
        const base = avg >= 0 ? [220, 38, 38] : [37, 99, 235];
        const rgb = [0, 1, 2].map((m) => Math.round((247 + (base[m] - 247) * t) * shade));
        const quad = { a, b, c, d, cx: (X[a] + X[c]) / 2, cy: (Y[a] + Y[c]) / 2, cv: avg, color: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`, mx: i % 8 === 0, my: j % 8 === 0, cont: null, lns: null };
        // 등고선
        const lo = Math.min(va, vb, vc, vd), hi = Math.max(va, vb, vc, vd);
        const k0 = Math.max(Math.ceil(lo / dv), -Math.floor((VCAP - 1) / dv));
        const k1 = Math.min(Math.floor(hi / dv), Math.floor((VCAP - 1) / dv));
        for (let k = k0; k <= k1; k++) {
          const L = k * dv;
          const pts = [];
          const cross = (p, q, vp, vq) => {
            if ((vp < L) !== (vq < L)) {
              const s = (L - vp) / (vq - vp);
              pts.push(X[p] + (X[q] - X[p]) * s, Y[p] + (Y[q] - Y[p]) * s);
            }
          };
          cross(a, b, va, vb);
          cross(b, c, vb, vc);
          cross(d, c, vd, vc);
          cross(a, d, va, vd);
          for (let p = 0; p + 3 < pts.length; p += 4) {
            (quad.cont = quad.cont || []).push(pts[p], pts[p + 1], pts[p + 2], pts[p + 3], L);
          }
        }
        quads.push(quad);
      }
    }
    // 전기력선을 곡면 위에 올린다 (칸마다 나눠 담아 가려짐을 맞춘다)
    getLines().forEach((pts) => {
      for (let p = 0; p + 3 < pts.length; p += 3) {
        const x1 = pts[p][0], y1 = pts[p][1], x2 = pts[p + 3][0], y2 = pts[p + 3][1];
        if (Math.abs(x1) > BOX_X || Math.abs(y1) > BOX_Y || Math.abs(x2) > BOX_X || Math.abs(y2) > BOX_Y) continue;
        field(x1, y1);
        const v1 = Fv;
        field(x2, y2);
        const v2 = Fv;
        if (Math.abs(v1) > VCAP || Math.abs(v2) > VCAP) continue;
        const i = Math.min(NX - 1, Math.floor(((x1 + x2) / 2 + BOX_X) / dx));
        const j = Math.min(NY - 1, Math.floor(((y1 + y2) / 2 + BOX_Y) / dy));
        const q = quads[j * NX + i];
        (q.lns = q.lns || []).push(x1, y1, v1, x2, y2, v2);
      }
    });
    cache.surface = { X, Y, V, quads, dv, order: quads.map((_, i) => i) };
    return cache.surface;
  }

  function projector() {
    const { w, h } = view;
    const cy_ = Math.cos(state.yaw), sy_ = Math.sin(state.yaw);
    const ce = Math.cos(state.el), se = Math.sin(state.el);
    const zs = (ZMAX * state.hgt) / VCAP;
    const floorZ = -ZMAX * state.hgt - 0.35;
    const R = Math.hypot(BOX_X, BOX_Y);
    const uMax = R * se + ZMAX * state.hgt * ce, uMin = -R * se + floorZ * ce;
    const s = Math.min((w - 30) / (2 * R), (h - 56) / (uMax - uMin)) * state.zoom;
    const cx = w / 2, cy = h / 2 + (((uMax + uMin) / 2) * s);
    const pt = (x, y, z) => {
      const X = x * cy_ - y * sy_;
      const Y = x * sy_ + y * cy_;
      const u = Y * se + z * ce;
      const dv = -Y * ce + z * se;
      const f = 30 / (30 - dv);
      return { x: cx + X * s * f, y: cy - u * s * f, d: dv };
    };
    return { pt, zs, floorZ, s, ce, se, cy_, sy_ };
  }

  function renderTab4(ctx) {
    const surf = getSurface();
    const P = projector();
    const { X, Y, V, quads, order } = surf;
    const clip = (v) => Math.max(-VCAP, Math.min(VCAP, v));

    // 꼭짓점 투영
    const n = X.length;
    const sx = new Float32Array(n), sy = new Float32Array(n), sd = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const p = P.pt(X[k], Y[k], clip(V[k]) * P.zs);
      sx[k] = p.x; sy[k] = p.y; sd[k] = p.d;
    }
    proj3d = { sx, sy, sd, X, Y };

    // 바닥: 등전위선과 전기력선을 평면 그림 그대로
    if (state.el < 1.5) {
      const c = [[-BOX_X, -BOX_Y], [BOX_X, -BOX_Y], [BOX_X, BOX_Y], [-BOX_X, BOX_Y]].map((q) => P.pt(q[0], q[1], P.floorZ));
      ctx.fillStyle = "#f5f5f5";
      ctx.strokeStyle = "#d4d4d4";
      ctx.lineWidth = 1;
      ctx.beginPath();
      c.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (state.contours3d) {
        ctx.strokeStyle = COLOR_EQ;
        ctx.lineWidth = 1;
        ctx.beginPath();
        quads.forEach((q) => {
          if (!q.cont) return;
          for (let i = 0; i < q.cont.length; i += 5) {
            const a = P.pt(q.cont[i], q.cont[i + 1], P.floorZ), b = P.pt(q.cont[i + 2], q.cont[i + 3], P.floorZ);
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
          }
        });
        ctx.stroke();
      }
      if (state.lines3d) {
        ctx.strokeStyle = "#8f8f8f";
        ctx.lineWidth = 1;
        ctx.beginPath();
        quads.forEach((q) => {
          if (!q.lns) return;
          for (let i = 0; i < q.lns.length; i += 6) {
            const a = P.pt(q.lns[i], q.lns[i + 1], P.floorZ), b = P.pt(q.lns[i + 3], q.lns[i + 4], P.floorZ);
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
          }
        });
        ctx.stroke();
      }
      if (plateOn) {
        [[-PLATE_X, COLOR_PLUS], [PLATE_X, COLOR_MINUS]].forEach(([x, col]) => {
          const a = P.pt(x, -PLATE_HALF, P.floorZ), b = P.pt(x, PLATE_HALF, P.floorZ);
          ctx.strokeStyle = col;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        });
      } else {
        activeConfig().charges.forEach((c) => {
          const a = P.pt(c.x, c.y, P.floorZ);
          ctx.fillStyle = c.Q > 0 ? COLOR_PLUS : COLOR_MINUS;
          ctx.beginPath();
          ctx.arc(a.x, a.y, 5, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    // 곡면: 먼 칸부터 칠한다
    const Y_ = (q) => q.cx * P.sy_ + q.cy * P.cy_;
    order.sort((i, j) => {
      const a = quads[i], b = quads[j];
      return (-Y_(a) * P.ce + clip(a.cv) * P.zs * P.se) - (-Y_(b) * P.ce + clip(b.cv) * P.zs * P.se);
    });
    ctx.lineWidth = 0.7;
    ctx.lineJoin = "round";
    // 칸마다 보이는 깊이를 적어 둔다 — 곡면 위 선은 다 칠한 뒤 이 값으로 가려짐을 판단한다
    const CELL = 3;
    const zw = Math.ceil(view.w / CELL) + 1, zh = Math.ceil(view.h / CELL) + 1;
    const zb = new Float32Array(zw * zh).fill(-1e9);
    const shown = (p) => {
      const i = Math.floor(p.x / CELL), j = Math.floor(p.y / CELL);
      if (i < 0 || j < 0 || i >= zw || j >= zh) return false;
      return p.d >= zb[j * zw + i] - 0.18;
    };
    for (let o = 0; o < order.length; o++) {
      const q = quads[order[o]];
      const dq = (sd[q.a] + sd[q.b] + sd[q.c] + sd[q.d]) / 4;
      const i0 = Math.max(0, Math.floor(Math.min(sx[q.a], sx[q.b], sx[q.c], sx[q.d]) / CELL));
      const i1 = Math.min(zw - 1, Math.floor(Math.max(sx[q.a], sx[q.b], sx[q.c], sx[q.d]) / CELL));
      const j0 = Math.max(0, Math.floor(Math.min(sy[q.a], sy[q.b], sy[q.c], sy[q.d]) / CELL));
      const j1 = Math.min(zh - 1, Math.floor(Math.max(sy[q.a], sy[q.b], sy[q.c], sy[q.d]) / CELL));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          if (dq > zb[j * zw + i]) zb[j * zw + i] = dq;
        }
      }
      ctx.fillStyle = q.color;
      ctx.strokeStyle = q.color;
      ctx.beginPath();
      ctx.moveTo(sx[q.a], sy[q.a]);
      ctx.lineTo(sx[q.b], sy[q.b]);
      ctx.lineTo(sx[q.c], sy[q.c]);
      ctx.lineTo(sx[q.d], sy[q.d]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (q.mx || q.my) {
        ctx.save();
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.beginPath();
        if (q.mx) { ctx.moveTo(sx[q.a], sy[q.a]); ctx.lineTo(sx[q.d], sy[q.d]); }
        if (q.my) { ctx.moveTo(sx[q.a], sy[q.a]); ctx.lineTo(sx[q.b], sy[q.b]); }
        ctx.stroke();
        ctx.restore();
      }
    }

    // 곡면 위 등고선·전기력선
    if (state.contours3d) {
      ctx.strokeStyle = "#0f766e";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      quads.forEach((q) => {
        if (!q.cont) return;
        for (let i = 0; i < q.cont.length; i += 5) {
          const z = q.cont[i + 4] * P.zs;
          const a = P.pt(q.cont[i], q.cont[i + 1], z), b = P.pt(q.cont[i + 2], q.cont[i + 3], z);
          if (shown(a) && shown(b)) {
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
          }
        }
      });
      ctx.stroke();
    }
    if (state.lines3d) {
      ctx.strokeStyle = "#171717";
      ctx.lineWidth = 1;
      ctx.beginPath();
      quads.forEach((q) => {
        if (!q.lns) return;
        for (let i = 0; i < q.lns.length; i += 6) {
          const a = P.pt(q.lns[i], q.lns[i + 1], q.lns[i + 2] * P.zs), b = P.pt(q.lns[i + 3], q.lns[i + 4], q.lns[i + 5] * P.zs);
          if (shown(a) && shown(b)) {
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
          }
        }
      });
      ctx.stroke();
    }

    // 봉우리·골짜기 위의 전하 표시
    if (!plateOn) {
      activeConfig().charges.forEach((c) => {
        field(c.x + 0.02, c.y);
        const a = P.pt(c.x, c.y, clip(Fv) * P.zs);
        if (!shown(a)) return;
        ctx.fillStyle = c.Q > 0 ? COLOR_PLUS : COLOR_MINUS;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(a.x, a.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        label(ctx, c.Q > 0 ? "+" : "−", a.x, a.y + 0.5, "#ffffff", { align: "center", bg: false, font: `600 11px ${FONT}` });
      });
    }

    // 점 찍기: 전기장은 내리막 방향
    const p = state.probe;
    field(p.x, p.y);
    const V0 = Fv, ex = Fx, ey = Fy, E = Math.hypot(ex, ey);
    const a0 = P.pt(p.x, p.y, clip(V0) * P.zs);
    if (E > 0) {
      const step = 0.55;
      const x2 = p.x + (ex / E) * step, y2 = p.y + (ey / E) * step;
      field(x2, y2);
      const b = P.pt(x2, y2, clip(Fv) * P.zs);
      arrow(ctx, a0.x, a0.y, b.x, b.y, "#ffffff", 6, 12);
      arrow(ctx, a0.x, a0.y, b.x, b.y, COLOR_F, 3, 11);
    }
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = COLOR_F;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(a0.x, a0.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    drawLegend3d(ctx);
  }

  // 높이가 뜻하는 전위
  function drawLegend3d(ctx) {
    const x = 16, y = 54, w = 12, h = 96;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, COLOR_PLUS);
    g.addColorStop(0.5, "#f7f7f7");
    g.addColorStop(1, COLOR_MINUS);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#d4d4d4";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    label(ctx, `+${VCAP / 1000} kV`, x + w + 6, y + 5, COLOR_SOFT, { bg: false, font: `11px ${MONO}` });
    label(ctx, "0 V", x + w + 6, y + h / 2, COLOR_SOFT, { bg: false, font: `11px ${MONO}` });
    label(ctx, `−${VCAP / 1000} kV`, x + w + 6, y + h - 5, COLOR_SOFT, { bg: false, font: `11px ${MONO}` });
  }

  // ---------- 탭 5 해석하기 ----------
  const DIRS = [
    { deg: 0, ch: "→" }, { deg: 45, ch: "↗" }, { deg: 90, ch: "↑" }, { deg: 135, ch: "↖" },
    { deg: 180, ch: "←" }, { deg: 225, ch: "↙" }, { deg: 270, ch: "↓" }, { deg: 315, ch: "↘" },
  ];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const rnd = (a, b) => a + Math.random() * (b - a);

  function quizConfig() {
    const kind = pick(["plus", "minus", "dipole", "same", "sameMinus", "plate"]);
    const Q = pick([1, 2, 3]);
    const sep = rnd(1.1, 1.9);
    if (kind === "plate") return { preset: "plate", charges: [], sel: 0 };
    if (kind === "plus") return { preset: "q", charges: [{ x: rnd(-1, 1), y: rnd(-0.5, 0.5), Q }], sel: 0 };
    if (kind === "minus") return { preset: "q", charges: [{ x: rnd(-1, 1), y: rnd(-0.5, 0.5), Q: -Q }], sel: 0 };
    if (kind === "dipole") return { preset: "q", charges: [{ x: -sep, y: 0, Q }, { x: sep, y: 0, Q: -Q }], sel: 0 };
    if (kind === "same") return { preset: "q", charges: [{ x: -sep, y: 0, Q }, { x: sep, y: 0, Q }], sel: 0 };
    return { preset: "q", charges: [{ x: -sep, y: 0, Q: -Q }, { x: sep, y: 0, Q: -Q }], sel: 0 };
  }

  function quizPoints(cfg, count) {
    const names = ["A", "B", "C", "D"];
    const pts = [];
    for (let tries = 0; tries < 400 && pts.length < count; tries++) {
      const x = rnd(-3.3, 3.3), y = rnd(-2.0, 2.0);
      if (cfg.charges.some((c) => Math.hypot(x - c.x, y - c.y) < 0.65)) continue;
      if (cfg.preset === "plate" && Math.abs(Math.abs(x) - PLATE_X) < 0.3) continue;
      if (pts.some((p) => Math.hypot(x - p.x, y - p.y) < 1.0)) continue;
      const f = fieldInfo(x, y);
      pts.push({ x, y, name: count === 1 ? "P" : names[pts.length], E: f.E, V: f.V, ex: f.ex, ey: f.ey });
    }
    return pts.length === count ? pts : null;
  }

  function newQuiz() {
    for (let attempt = 0; attempt < 300; attempt++) {
      const cfg = quizConfig();
      state.quiz = { cfg };
      rebuildSources();
      const kind = pick(["strong", "weak", "high", "dir", "sign"]);
      const q = buildQuestion(kind, cfg);
      if (q) {
        state.quiz = { cfg, kind, ...q, picked: null };
        syncChoices();
        syncUI();
        draw();
        return;
      }
    }
  }

  function buildQuestion(kind, cfg) {
    if (kind === "sign") {
      if (cfg.preset === "plate") return null;
      const target = cfg.charges.reduce((a, b) => (b.x < a.x ? b : a));
      return {
        points: [],
        prompt: cfg.charges.length > 1 ? "왼쪽 전하의 종류는?" : "이 전하의 종류는?",
        choices: [{ key: "+", text: "+ 양전하" }, { key: "−", text: "− 음전하" }],
        answer: target.Q > 0 ? "+" : "−",
        view: { lines: true, equip: false, arrows: true, hidden: true },
        why: "전기력선이 나오면 양전하, 들어가면 음전하다.",
      };
    }
    if (kind === "dir") {
      const pts = quizPoints(cfg, 1);
      if (!pts) return null;
      const p = pts[0];
      if (p.E < 1500) return null;
      const deg = (Math.atan2(p.ey, p.ex) * 180) / Math.PI;
      const near = DIRS.find((d) => {
        const diff = Math.abs(((deg - d.deg + 540) % 360) - 180);
        return diff < 11;
      });
      if (!near) return null;
      const eq = Math.random() < 0.5;
      return {
        points: pts,
        prompt: "점 P에서 전기장의 방향은?",
        choices: DIRS.map((d) => ({ key: d.ch, text: d.ch })),
        answer: near.ch,
        view: eq ? { lines: false, equip: true, arrows: false } : { lines: true, equip: false, arrows: true },
        why: eq ? "전기장은 등전위선에 수직이고 전위가 낮아지는 쪽을 향한다." : "전기장의 방향은 전기력선의 접선 방향이다.",
      };
    }
    const pts = quizPoints(cfg, 4);
    if (!pts) return null;
    if (kind === "high") {
      const sorted = [...pts].sort((a, b) => b.V - a.V);
      if (sorted[0].V - sorted[1].V < 3000) return null;
      return {
        points: pts,
        prompt: "전위가 가장 높은 점은?",
        choices: pts.map((p) => ({ key: p.name, text: p.name })),
        answer: sorted[0].name,
        show: "V",
        view: { lines: false, equip: true, arrows: false },
        why: "양전하에 가까울수록 전위가 높다. 등전위선의 값을 비교한다.",
      };
    }
    const sorted = [...pts].sort((a, b) => b.E - a.E);
    const top = kind === "strong" ? sorted[0] : sorted[3];
    const ratio = kind === "strong" ? sorted[0].E / sorted[1].E : sorted[2].E / sorted[3].E;
    if (ratio < 1.5) return null;
    const useEq = Math.random() < 0.5;
    return {
      points: pts,
      prompt: kind === "strong" ? "전기장이 가장 센 점은?" : "전기장이 가장 약한 점은?",
      choices: pts.map((p) => ({ key: p.name, text: p.name })),
      answer: top.name,
      show: "E",
      view: useEq ? { lines: false, equip: true, arrows: false } : { lines: true, equip: false, arrows: true },
      why: useEq ? "등전위선이 조밀할수록 전기장이 세다." : "전기력선이 촘촘할수록 전기장이 세다.",
    };
  }

  function syncChoices() {
    const row = $("choiceRow");
    row.innerHTML = "";
    const q = state.quiz;
    if (!q || !q.choices) return;
    const seg = document.createElement("div");
    seg.className = "seg seg-n";
    q.choices.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = c.text;
      b.dataset.key = c.key;
      b.addEventListener("click", () => answerQuiz(c.key));
      seg.appendChild(b);
    });
    row.appendChild(seg);
  }

  function answerQuiz(key) {
    const q = state.quiz;
    if (!q || q.picked != null) return;
    q.picked = key;
    state.score.total++;
    if (key === q.answer) state.score.right++;
    syncUI();
    draw();
  }

  function renderTab5(ctx) {
    drawGridBg(ctx);
    const q = state.quiz;
    if (!q || !q.view) return;
    const done = q.picked != null;
    if (q.view.equip) drawContours(ctx, true);
    if (q.view.lines) drawLines(ctx, q.view.arrows);
    drawSources(ctx, { hidden: q.view.hidden && !done });
    q.points.forEach((p) => {
      const px = toX(p.x), py = toY(p.y);
      if (done && q.show !== "V") cappedArrow(ctx, px, py, p.ex / p.E, -p.ey / p.E, p.E * E_ARROW, 200, COLOR_F, 2.5);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = COLOR_E;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      label(ctx, p.name, px, py + 0.5, COLOR_E, { align: "center", bg: false, font: `600 12px ${FONT}` });
      if (done) {
        const text = q.show === "V" ? `${sig3(p.V)} V` : `${sig3(p.E)} N/C`;
        label(ctx, text, px, py + 19, COLOR_F, { align: "center", font: `500 11px ${MONO}` });
      }
    });
  }

  // ---------- 렌더 ----------
  let pending = false;
  function draw() {
    if (pending) return;
    pending = true;
    const run = () => {
      if (!pending) return;
      pending = false;
      render();
    };
    requestAnimationFrame(run);
    setTimeout(run, 60); // 화면이 멈춰 있어도 값과 그림은 갱신한다
  }

  function render() {
    updateView();
    const { w, h, ctx } = SimUtils.fitCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    if (state.tab === 1) renderTab1(ctx);
    else if (state.tab === 2) renderTab2(ctx);
    else if (state.tab === 3) renderTab3(ctx);
    else if (state.tab === 4) renderTab4(ctx);
    else renderTab5(ctx);
    updateCards();
  }

  // ---------- 카드 ----------
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
    el.f1.textContent = m.f1 || "";
  }

  function ratioText(x) {
    if (Math.abs(x - 1) < 0.005) return "1배";
    return `${Number(x.toPrecision(3))}배`;
  }

  function updateCards() {
    let cards;
    if (state.tab === 1) {
      const t = state.t1;
      const { F, repel } = t1Force();
      const Qq = Math.abs(t.Q * t.q);
      const b = t.base;
      cards = [
        {
          name: "전기력",
          tag: { text: repel ? "척력" : "인력" },
          sym: "F",
          val: sig3(F),
          unit: "N",
          rows: [{ k: "r", v: `${t.r.toFixed(1)} m` }, { k: "|Qq|", v: `${Qq} μC²` }],
          f1: "F = k Qq / r²",
        },
        b ? {
          name: "기준과 비교",
          sym: "F/F₀",
          val: ratioText(F / b.F),
          unit: "",
          rows: [{ k: "r/r₀", v: ratioText(t.r / b.r) }, { k: "Qq/Q₀q₀", v: ratioText(Qq / b.Qq) }],
          f1: `기준: r₀ = ${b.r.toFixed(1)} m, F₀ = ${sig3(b.F)} N`,
        } : {
          name: "기준과 비교",
          sym: "F/F₀",
          val: null,
          unit: "",
          rows: [{ k: "r/r₀", v: "–" }, { k: "Qq/Q₀q₀", v: "–" }],
          f1: "기준을 잡고 r이나 q를 바꿔 보자.",
        },
      ];
    } else if (state.tab === 2) {
      const t = state.test;
      const f = fieldInfo(t.x, t.y);
      const F = f.E * Math.abs(t.q) * UC;
      cards = [
        t.on ? {
          name: "시험 전하가 받는 힘",
          tag: { text: t.q > 0 ? "E와 같은 방향" : "E와 반대 방향" },
          sym: "F",
          val: sig3(F),
          unit: "N",
          rows: [{ k: "q", v: `${signed(t.q)} μC` }, { k: "F/|q|", v: `${sig3(F / (Math.abs(t.q) * UC))} N/C` }],
          f1: "F = qE. q를 바꾸면 F는 바뀐다.",
        } : {
          name: "시험 전하 없음",
          sym: "F",
          val: null,
          unit: "",
          rows: [{ k: "q", v: "–" }, { k: "F/|q|", v: "–" }],
          f1: "힘을 받을 전하는 없어도 전기장은 그대로다.",
        },
        {
          name: "이 자리의 전기장",
          sym: "E",
          val: sig3(f.E),
          unit: "N/C",
          rows: [{ k: "방향", v: `${degOf(f.ex, f.ey)}°` }, { k: "전하 수", v: plateOn ? "평행판" : `${state.field.charges.length}개` }],
          f1: "E = F/q. 양전하가 받는 힘의 방향이다.",
        },
      ];
    } else if (state.tab === 3) {
      const p = state.probe;
      const f = fieldInfo(p.x, p.y);
      const c = !plateOn && state.field.charges[state.field.sel];
      cards = [
        {
          name: "찍은 점의 전기장",
          sym: "E",
          val: sig3(f.E),
          unit: "N/C",
          rows: [{ k: "방향", v: `${degOf(f.ex, f.ey)}°` }, { k: "전위", v: `${sig3(f.V)} V` }],
          f1: "선의 접선 방향이 전기장의 방향이다.",
        },
        {
          name: "전기력선 수",
          sym: "N",
          val: c ? String(linesOf(c.Q)) : null,
          unit: c ? "개" : "",
          rows: [{ k: "전하량", v: c ? `${signed(c.Q)} μC` : "–" }, { k: "1 μC당", v: `${state.density}개` }],
          f1: "전하량이 클수록 선이 많다. 간격은 그림에서 비교하고 값은 점을 찍어 읽는다.",
        },
      ];
    } else if (state.tab === 4) {
      const p = state.probe;
      const f = fieldInfo(p.x, p.y);
      const ds = 0.02;
      const ux = f.E ? f.ex / f.E : 1, uy = f.E ? f.ey / f.E : 0;
      field(p.x - ux * ds, p.y - uy * ds);
      const v1 = Fv;
      field(p.x + ux * ds, p.y + uy * ds);
      const v2 = Fv;
      const slope = (v1 - v2) / (2 * ds);
      cards = [
        {
          name: "찍은 점의 전위",
          sym: "V",
          val: sig3(f.V),
          unit: "V",
          rows: [{ k: "x", v: `${p.x.toFixed(1)} m` }, { k: "y", v: `${p.y.toFixed(1)} m` }],
          f1: "V = W/q. 무한히 먼 곳이 0 V다.",
        },
        {
          name: "경사와 전기장",
          sym: "E",
          val: sig3(f.E),
          unit: "N/C",
          rows: [{ k: "경사 ΔV/Δs", v: `${sig3(slope)} V/m` }, { k: "방향", v: `${degOf(f.ex, f.ey)}°` }],
          f1: "경사가 급할수록 전기장이 세다. 전기장은 내리막 방향이다.",
        },
      ];
    } else {
      const q = state.quiz;
      const s = state.score;
      const done = q && q.picked != null;
      const ok = done && q.picked === q.answer;
      cards = [
        {
          name: "맞힌 문제",
          sym: "",
          val: `${s.right} / ${s.total}`,
          unit: "",
          rows: [{ k: "그림", v: q && q.view ? (q.view.lines ? "전기력선" : "등전위선") : "–" }, { k: "", v: "" }],
          f1: "그림만 보고 먼저 추리한 뒤 답을 고른다.",
        },
        {
          name: done ? "결과" : "이 문제",
          tag: done ? { text: ok ? "맞음" : "다시 보자", cls: ok ? "is-ok" : "is-no" } : null,
          sym: "",
          val: done ? `답: ${q.answer}` : null,
          unit: "",
          rows: [{ k: "", v: "" }, { k: "", v: "" }],
          f1: done ? q.why : "답을 고르면 계산한 값을 그림에 보여 준다.",
        },
      ];
    }
    cards.forEach((m, i) => applyCard(cardEls[i], m));
  }

  // ---------- 조작 ----------
  const P = {
    t1Q: { min: -5, max: 5, step: 1, get: () => state.t1.Q, set: (v) => { state.t1.Q = v; } , nz: true },
    t1q: { min: -5, max: 5, step: 1, get: () => state.t1.q, set: (v) => { state.t1.q = v; }, nz: true },
    t1r: { min: 0.5, max: 6, step: 0.1, get: () => state.t1.r, set: (v) => { setR(v); } },
    selQ: {
      min: -5, max: 5, step: 1, nz: true,
      get: () => { const c = state.field.charges[state.field.sel]; return c ? c.Q : 1; },
      set: (v) => {
        const c = state.field.charges[state.field.sel];
        if (c) { c.Q = v; rebuildSources(); }
      },
    },
    testq: { min: -3, max: 3, step: 0.5, nz: true, get: () => state.test.q, set: (v) => { state.test.q = v; } },
    dens: { min: 3, max: 10, step: 1, get: () => state.density, set: (v) => { state.density = v; invalidate(); } },
    hgt: { min: 0.5, max: 1.5, step: 0.1, get: () => state.hgt, set: (v) => { state.hgt = v; } },
  };

  function setR(r) {
    const t = state.t1;
    t.r = r;
    const qx = T1_Q.x + r * Math.cos(t.angle), qy = T1_Q.y + r * Math.sin(t.angle);
    if (Math.abs(qx) > view.hx - 0.3 || Math.abs(qy) > view.hy - 0.3) t.angle = 0;
  }

  function setParam(key, raw) {
    const p = P[key];
    let v = Number(raw);
    if (!isFinite(v)) { syncUI(); return; }
    v = Math.max(p.min, Math.min(p.max, Math.round(v / p.step) * p.step));
    v = Number(v.toFixed(2));
    if (p.nz && v === 0) v = p.get() > 0 ? -p.step : p.step; // 0을 건너뛴다: 전하는 + 또는 −다
    p.set(v);
    syncUI();
    draw();
  }

  function setPreset(name) {
    state.field.preset = name;
    state.field.charges = PRESETS[name]();
    state.field.sel = 0;
    rebuildSources();
    syncUI();
    draw();
  }

  function addCharge(sign) {
    const f = state.field;
    if (f.preset === "plate") return;
    if (f.charges.length >= MAX_CHARGES) return;
    const spots = [[0, 1.4], [0, -1.4], [-2.6, 1.2], [2.6, 1.2], [-2.6, -1.2], [2.6, -1.2], [0, 0]];
    const free = spots.find(([x, y]) => f.charges.every((c) => Math.hypot(x - c.x, y - c.y) > 0.8)) || spots[0];
    f.charges.push({ x: free[0], y: free[1], Q: sign * 2 });
    f.sel = f.charges.length - 1;
    f.preset = "custom";
    rebuildSources();
    syncUI();
    draw();
  }

  function removeCharge() {
    const f = state.field;
    if (f.preset === "plate" || f.charges.length <= 1) return;
    f.charges.splice(f.sel, 1);
    f.sel = Math.max(0, f.sel - 1);
    f.preset = "custom";
    rebuildSources();
    syncUI();
    draw();
  }

  function toggle(key) {
    state[key] = !state[key];
    syncUI();
    draw();
  }

  function setTab(n) {
    state.tab = n;
    if (n === 5 && !(state.quiz && state.quiz.view)) newQuiz();
    rebuildSources();
    syncUI();
    draw();
  }

  const STATUS = {
    1: "두 전하 사이의 힘",
    2: "전기장은 그 자리 공간의 성질",
    3: "전기장의 방향을 이은 선",
    4: "전위의 높낮이",
  };
  const HINT = {
    1: "오른쪽 전하를 끌어 거리를 바꾼다",
    2: "전하와 시험 전하를 끌어 옮긴다 · 빈 곳을 누르면 시험 전하가 온다",
    3: "전하를 끌어 옮긴다 · 빈 곳을 누르면 그 점의 전기장을 읽는다",
    4: "높이는 전위를 나타낸 그림이다(실제 높이 아님) · 끌기: 회전 · 휠: 확대 · 누르기: 그 점 읽기",
    5: "",
  };

  function syncBtn(id, on) {
    const b = $(id);
    b.classList.toggle("is-on", !!on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function syncUI() {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("is-active", Number(b.dataset.tab) === state.tab));
    const pane = state.tab === 1 ? "1" : state.tab === 5 ? "5" : "field";
    document.querySelectorAll(".ctrl-pane").forEach((el) => el.classList.toggle("hidden", el.dataset.pane !== pane));
    document.querySelectorAll("[data-only]").forEach((el) => el.classList.toggle("is-off", Number(el.dataset.only) !== state.tab));

    Object.keys(P).forEach((key) => {
      const p = P[key];
      const input = $(key + "Input"), num = $(key + "Num");
      input.min = p.min;
      input.max = p.max;
      input.step = p.step;
      input.value = p.get();
      num.min = p.min;
      num.max = p.max;
      num.step = p.step;
      if (document.activeElement !== num) num.value = p.get();
    });

    const f = state.field;
    document.querySelectorAll("#presetSeg button").forEach((b) => b.classList.toggle("is-active", b.dataset.preset === f.preset));
    const isPlate = f.preset === "plate";
    $("addPlusBtn").disabled = isPlate || f.charges.length >= MAX_CHARGES;
    $("addMinusBtn").disabled = isPlate || f.charges.length >= MAX_CHARGES;
    $("removeBtn").disabled = isPlate || f.charges.length <= 1;
    $("selQInput").disabled = isPlate;
    $("selQNum").disabled = isPlate;

    syncBtn("testBtn", state.test.on);
    syncBtn("gridBtn", state.showGrid);
    syncBtn("partsBtn", state.showParts);
    $("partsBtn").disabled = isPlate;
    syncBtn("arrowsBtn", state.showArrows);
    syncBtn("eqBtn", state.showEq);
    syncBtn("contourBtn", state.contours3d);
    syncBtn("surfLinesBtn", state.lines3d);
    syncBtn("topBtn", state.el > 1.55);
    $("baseClearBtn").disabled = !state.t1.base;
    $("dvSelect").value = String(state.dv);

    const q = state.quiz;
    if (state.tab === 5 && q && q.view) {
      $("statusTag").textContent = q.prompt;
      $("choiceRow").querySelectorAll("button").forEach((b) => {
        const done = q.picked != null;
        b.disabled = done;
        b.classList.toggle("is-right", done && b.dataset.key === q.answer);
        b.classList.toggle("is-wrong", done && b.dataset.key === q.picked && q.picked !== q.answer);
      });
    } else {
      $("statusTag").textContent = STATUS[state.tab] || "";
    }
    $("stageHint").textContent = HINT[state.tab];
    $("stageHint").classList.toggle("hidden", !HINT[state.tab]);
    canvas.style.cursor = state.tab === 4 ? "grab" : "default";
  }

  function reset() {
    const tab = state.tab;
    state = freshState();
    state.tab = tab;
    if (tab === 5) newQuiz();
    rebuildSources();
    syncUI();
    draw();
  }

  // ---------- 끌기 ----------
  function hitCharge(px, py) {
    if (plateOn) return -1;
    const list = state.field.charges;
    for (let i = list.length - 1; i >= 0; i--) {
      const R = 11 + Math.abs(list[i].Q) * 1.6 + 5;
      if (Math.hypot(px - toX(list[i].x), py - toY(list[i].y)) <= R) return i;
    }
    return -1;
  }

  function moveT1(px, py) {
    const t = state.t1;
    const x = fromX(px) - T1_Q.x, y = fromY(py) - T1_Q.y;
    const lim = view.hx - 0.3;
    const r = Math.hypot(x, y);
    t.angle = Math.atan2(y, x);
    let rr = Math.max(0.5, Math.min(6, r));
    rr = Math.round(rr * 10) / 10;
    const qx = T1_Q.x + rr * Math.cos(t.angle);
    if (qx > lim) rr = Math.max(0.5, (lim - T1_Q.x) / Math.max(0.1, Math.cos(t.angle)));
    t.r = Number(rr.toFixed(1));
  }

  function bindPointer() {
    const pos = (e) => {
      updateView();
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const clampWorld = (x, y) => ({ x: Math.max(-LIM_X, Math.min(LIM_X, x)), y: Math.max(-LIM_Y, Math.min(LIM_Y, y)) });

    canvas.addEventListener("pointerdown", (e) => {
      const pt = pos(e);
      const tab = state.tab;
      if (tab === 5) return;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 포인터가 이미 사라졌으면 잡지 않고 진행 */ }
      if (tab === 1) {
        drag = { kind: "t1" };
        moveT1(pt.x, pt.y);
      } else if (tab === 4) {
        drag = { kind: "rot", x: pt.x, y: pt.y, sx: pt.x, sy: pt.y, yaw: state.yaw, el: state.el, moved: false };
        canvas.style.cursor = "grabbing";
        return;
      } else {
        const t = state.test;
        if (tab === 2 && t.on && Math.hypot(pt.x - toX(t.x), pt.y - toY(t.y)) < 14) {
          drag = { kind: "test" };
        } else {
          const i = hitCharge(pt.x, pt.y);
          if (i >= 0) {
            state.field.sel = i;
            drag = { kind: "charge", i };
          } else if (tab === 2) {
            drag = { kind: "test" };
            const w = clampWorld(fromX(pt.x), fromY(pt.y));
            t.x = w.x; t.y = w.y;
          } else {
            drag = { kind: "probe" };
            const w = clampWorld(fromX(pt.x), fromY(pt.y));
            state.probe.x = w.x; state.probe.y = w.y;
          }
        }
      }
      syncUI();
      draw();
    });

    canvas.addEventListener("pointermove", (e) => {
      const pt = pos(e);
      if (!drag) {
        if (state.tab === 2 || state.tab === 3) {
          const t = state.test;
          const onTest = state.tab === 2 && t.on && Math.hypot(pt.x - toX(t.x), pt.y - toY(t.y)) < 14;
          canvas.style.cursor = onTest || hitCharge(pt.x, pt.y) >= 0 ? "grab" : "default";
        }
        return;
      }
      if (drag.kind === "t1") {
        moveT1(pt.x, pt.y);
        syncUI();
      } else if (drag.kind === "test" || drag.kind === "probe") {
        const w = clampWorld(fromX(pt.x), fromY(pt.y));
        const o = drag.kind === "test" ? state.test : state.probe;
        o.x = w.x; o.y = w.y;
      } else if (drag.kind === "charge") {
        const w = clampWorld(fromX(pt.x), fromY(pt.y));
        const c = state.field.charges[drag.i];
        c.x = w.x; c.y = w.y;
        if (state.field.preset !== "custom") { state.field.preset = "custom"; syncUI(); }
        rebuildSources();
      } else if (drag.kind === "rot") {
        if (Math.hypot(pt.x - drag.sx, pt.y - drag.sy) > 4) drag.moved = true;
        if (drag.moved) {
          state.yaw = drag.yaw + (pt.x - drag.sx) * 0.008;
          state.el = Math.max((12 * Math.PI) / 180, Math.min(Math.PI / 2, drag.el + (pt.y - drag.sy) * 0.006));
          syncBtn("topBtn", state.el > 1.55);
        }
      }
      draw();
    });

    const end = (e) => {
      if (drag && drag.kind === "rot") {
        if (!drag.moved) pickSurface(pos(e));
        canvas.style.cursor = "grab";
      }
      drag = null;
      draw();
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", () => { drag = null; });
    canvas.addEventListener("wheel", (e) => {
      if (state.tab !== 4) return;
      e.preventDefault();
      state.zoom = Math.max(1, Math.min(2.2, state.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
      draw();
    }, { passive: false });
  }

  // 곡면 위 찍은 자리: 화면에서 가까운 꼭짓점 중 보는 쪽에 가장 가까운 것
  function pickSurface(pt) {
    if (!proj3d) return;
    const { sx, sy, sd, X, Y } = proj3d;
    let best = -1, bestD = -Infinity;
    for (let k = 0; k < sx.length; k++) {
      const d = Math.hypot(sx[k] - pt.x, sy[k] - pt.y);
      if (d < 9 && sd[k] > bestD) { bestD = sd[k]; best = k; }
    }
    if (best >= 0) {
      state.probe.x = X[best];
      state.probe.y = Y[best];
    }
  }

  // ---------- 연결 ----------
  function bind() {
    document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => setTab(Number(b.dataset.tab))));
    $("resetBtn").addEventListener("click", reset);
    $("baseBtn").addEventListener("click", () => {
      const t = state.t1;
      t.base = { F: t1Force().F, r: t.r, Qq: Math.abs(t.Q * t.q) };
      syncUI();
      draw();
    });
    $("baseClearBtn").addEventListener("click", () => { state.t1.base = null; syncUI(); draw(); });
    document.querySelectorAll("#presetSeg button").forEach((b) => b.addEventListener("click", () => setPreset(b.dataset.preset)));
    $("addPlusBtn").addEventListener("click", () => addCharge(1));
    $("addMinusBtn").addEventListener("click", () => addCharge(-1));
    $("removeBtn").addEventListener("click", removeCharge);
    $("testBtn").addEventListener("click", () => { state.test.on = !state.test.on; syncUI(); draw(); });
    $("gridBtn").addEventListener("click", () => toggle("showGrid"));
    $("partsBtn").addEventListener("click", () => toggle("showParts"));
    $("arrowsBtn").addEventListener("click", () => toggle("showArrows"));
    $("eqBtn").addEventListener("click", () => toggle("showEq"));
    $("contourBtn").addEventListener("click", () => toggle("contours3d"));
    $("surfLinesBtn").addEventListener("click", () => toggle("lines3d"));
    $("topBtn").addEventListener("click", () => {
      state.el = state.el > 1.55 ? (35 * Math.PI) / 180 : Math.PI / 2;
      if (state.el > 1.55) state.yaw = 0;
      syncUI();
      draw();
    });
    $("nextBtn").addEventListener("click", newQuiz);
    $("scoreClearBtn").addEventListener("click", () => { state.score = { right: 0, total: 0 }; draw(); });
    Object.keys(P).forEach((key) => {
      $(key + "Input").addEventListener("input", (e) => setParam(key, e.target.value));
      $(key + "Num").addEventListener("change", (e) => setParam(key, e.target.value));
    });
    document.querySelectorAll(".num").forEach((el) =>
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); }));
    $("dvSelect").addEventListener("change", (e) => { state.dv = Number(e.target.value); invalidate(); draw(); });
    $("settingsToggle").addEventListener("click", () => $("settingsOverlay").classList.remove("hidden"));
    $("settingsClose").addEventListener("click", () => $("settingsOverlay").classList.add("hidden"));
    $("settingsBackdrop").addEventListener("click", () => $("settingsOverlay").classList.add("hidden"));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") $("settingsOverlay").classList.add("hidden");
    });
    window.addEventListener("resize", draw);
    // 글꼴이 늦게 불러와져도 무대 크기가 바뀐다 — 창 크기만 보면 놓친다
    if (window.ResizeObserver) new ResizeObserver(draw).observe(canvas);
    bindPointer();
  }

  function init() {
    canvas = $("simCanvas");
    cardEls = [...document.querySelectorAll(".obs-card")].map((card) => {
      const q = (role) => card.querySelector(`[data-role="${role}"]`);
      return {
        name: q("name"), tag: q("tag"), fbox: q("fbox"), sym: q("sym"), val: q("val"), unit: q("unit"),
        k: [q("k1"), q("k2")], v: [q("v1"), q("v2")], f1: q("f1"),
      };
    });
    bind();
    rebuildSources();
    updateView();
    syncUI();
    draw();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
