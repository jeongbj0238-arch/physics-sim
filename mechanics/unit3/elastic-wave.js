/* ============================================================
   탄성파의 진행과 반사
   교과서: (동아출판) 역학과 에너지 pp.98~105 「02 탄성파의 진행과 활용」
   성취기준: [12역학03-02]

   1 파동의 진행    펄스·연속파, 횡파·종파, 제자리 진동, v = fλ   (pp.98~100)
   2 끝에서의 반사  고정단은 위상 반대, 자유단은 그대로           (p.101 그림 III-8·9)
   3 매질이 바뀔 때 경계에서 반사와 투과가 함께 일어난다          (p.102 그림 III-10·11)
                    얇은 줄과 두꺼운 줄 — 두께가 d배면 질량은 d²배(단면적), 속력은 1/d배

   ※ 교육과정 — 파동 방정식 없이 "탄성체의 연속적 결합"으로 파동을 설명한다.
      사슬의 마디 하나하나는 양옆 용수철에 당겨지기만 한다. 그게 이어져 파동이 된다.
   ※ 속력·파장·반사 높이는 공식으로 띄우지 않고 사슬 위에서 잰다.
   ※ 마디는 1.25 cm 간격(481개)으로 계산하고, 8개마다 하나(61개)를 공으로 그린다.
      마디가 성기면 파장이 짧을 때 속력이 느려진다. 2.5 cm 간격에서는 두께 3배 줄의 속력이
      0.67이 아니라 0.66 m/s로 재졌다 (두꺼운 줄은 파장이 짧다).
   ※ 반사 없는 끝은 끝 마디에 완충기(속도에 비례하는 저항, 크기 = 줄의 임피던스)를 달아 만든다.
      처음엔 화면 밖에 감쇠 구간을 이어 붙였는데, 펄스의 느린 성분을 되돌려 보내
      펄스가 지나간 뒤 사슬 전체가 2 cm쯤 처졌다. 완충기는 느린 성분일수록 더 잘 흡수한다.
   ※ 탭 2·3의 연속파는 손잡이 대신 왼쪽으로 이어진 줄에서 들어온다. 손잡이로 계속 흔들면
      돌아온 반사파가 손잡이에서 다시 반사돼 줄 안을 왕복하며 진폭이 끝없이 커진다.
   ※ 입사파는 반사가 없는 줄을 하나 더 돌려서 얻는다. 반사파 = 실제 줄 − 입사파.
   ============================================================ */

(() => {
  "use strict";

  /* ---------------------------------------------------------
     캔버스에 직접 그리는 색.
     CSS의 변수와는 별개의 하드코딩 상수다.
     색을 바꿀 때는 elastic-wave.css와 여기를 함께 고쳐야 한다.
     --------------------------------------------------------- */
  const COLOR_STAGE  = "#ffffff";
  const COLOR_INK    = "#171717";
  const COLOR_BODY   = "#4d4d4d";
  const COLOR_MUTE   = "#8f8f8f";
  const COLOR_SPRING = "#bdbdbd";
  const COLOR_AXIS   = "#e6e6e6";
  const COLOR_BEAD   = "#3a3a3a";
  const COLOR_UP     = "#0070f3";   // 위로 (+)
  const COLOR_DOWN   = "#ee0000";   // 아래로 (−)
  const COLOR_INC    = "#9e9e9e";   // 연속파의 입사파 (점선)
  const COLOR_REFL   = "#7928ca";   // 연속파의 반사파 — 도플러 효과의 되돌아오는 파면과 같은 보라

  const L = 6;                       // 사슬 길이 (m)
  const NODES = 481;                 // 계산하는 마디 수
  const DX = L / (NODES - 1);        // 마디 간격 0.0125 m
  const BEAD_EVERY = 8;              // 마디 8개마다 공 하나 → 61개
  const SPEED = { T: 2.0, L: 3.5 };  // 얇은 줄의 횡파 · 종파 속력 (m/s) — 지진파처럼 종파가 약 1.7배 빠르다
  const AMP = { T: 0.3, L: 0.25 };   // 펄스·연속파 진폭 (m)
  const AMP_FEED = 0.25;             // 탭 2·3 연속파 진폭 — 반사파와 겹쳐 두 배가 돼도 무대에 들어가게
  const F_MIN = 0.5;
  const F_MAX = 3;                   // 연속파 진동수 (Hz). 탭 3은 두꺼운 줄의 파장이 0.67 m보다 짧아지지 않게 더 낮춘다
  const STRAIN_MAX = 0.6;            // 종파에서 용수철이 줄어들 수 있는 최대 비율 — 넘으면 공끼리 겹친다
  const DRAG_MAX = { T: 0.45, L: 0.2 };
  const PULSE_SEC = 0.5;             // 펄스 한 번을 만드는 데 걸리는 시간
  const DT = 0.001;                  // 계산 시간 간격 (s)
  const P_X = 2.0;                   // 점 P의 평형 위치 (m) — 탭 1·2
  const MARK_X = [1.0, 4.0];         // 탭 1 — 속력을 재는 표시선 (m)
  const JOIN_X = 3.0;                // 탭 3 — 두 줄이 이어진 곳
  const PROBE_X = { A: 1.5, B: 4.5 };// 탭 3 — 반사·투과 펄스의 높이를 재는 곳
  const SPEED_MARKS = { A: [0.75, 2.25], B: [3.75, 5.25] };   // 탭 3 — 각 줄의 속력을 재는 구간 (그리지 않음)
  const STRIP_SEC = 6;               // 카드 그래프에 담는 시간 (s) — 탭 2에서 들어간 펄스와 돌아온 펄스가 함께 들어가게
  const STRIP_DT = 0.01;
  const MODE_NAME = { T: "횡파", L: "종파" };
  const END_NAME = { fixed: "고정단", free: "자유단" };

  const $ = (id) => document.getElementById(id);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const node = (x) => Math.round(x / DX);   // 위치(m) → 마디 번호
  const signed = (x, d = 2) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(d)}`;
  const signCls = (x) => (x > 0 ? "is-hi" : x < 0 ? "is-lo" : "");

  const I0 = 0;                      // 손잡이가 달린 마디
  const IN = NODES - 1;              // 오른쪽 끝 마디
  const IP = node(P_X);
  const IJ = node(JOIN_X);
  const IA = node(PROBE_X.A);
  const IB = node(PROBE_X.B);

  const y = new Float64Array(NODES);     // 변위 — 횡파는 위아래, 종파는 앞뒤
  const vel = new Float64Array(NODES);
  const mass = new Float64Array(NODES).fill(1);   // 얇은 줄 마디 = 1

  // 입사파만 있는 줄 — 오른쪽 끝을 반사 없는 끝으로 둔 같은 줄 (탭 3은 왼쪽 줄로만 이어진 줄)
  const yR = new Float64Array(NODES);
  const velR = new Float64Array(NODES);
  const massR = new Float64Array(NODES).fill(1);

  const state = {
    tab: 1,
    paused: false,
    slow: 1,
    mode: "T",          // 탭 1에서만 바꾼다 — 탭 2·3은 교과서 그림처럼 횡파
    end: "fixed",       // 탭 2 오른쪽 끝
    order: "LH",        // 탭 3 — LH 얇은 → 두꺼운, HL 두꺼운 → 얇은
    thick: 2,           // 탭 3 두꺼운 줄의 두께 (얇은 줄의 몇 배)
    f: 1.0,
    parts: true,        // 탭 2·3 연속파 — 입사파·반사파를 따로 그린다
    cards: "pulse",     // 탭 2·3 카드 — 마지막으로 보낸 것이 펄스인지 연속파인지
    contSince: 0,       // 연속파를 켜거나 진동수를 바꾼 시각
    t: 0,
    drive: null,        // { kind: "pulse", t0 } · { kind: "cont", on, env, phase, s } · { kind: "drag" | "return", y }
    dragTarget: 0,
  };
  const savedF = { 1: 1.0, 2: 1.0, 3: 1.0 };   // 진동수는 탭마다 따로 기억한다

  let canvas = null;
  let lastG = null;
  let cardEls = [];

  const rightEnd = () => (state.tab === 2 ? state.end : "absorb");
  const kappa = () => (SPEED[state.mode] / DX) ** 2;   // 질량 1인 마디 기준 용수철 세기
  const isCont = () => !!state.drive && state.drive.kind === "cont";
  const feed = () => state.tab !== 1 && isCont();     // 탭 2·3 연속파 — 왼쪽으로 이어진 줄에서 들어온다
  const fMax = () => (state.tab === 3 ? Math.min(F_MAX, Math.floor(30 / state.thick + 1e-9) / 10) : F_MAX);

  /* ---------------------------------------------------------
     물리 — 마디마다 양옆 용수철의 힘만 받는다
     --------------------------------------------------------- */
  // 연속파 진폭 — 종파는 진동수가 크면 파장이 짧아져 같은 진폭에도 공끼리 겹치므로 줄인다
  function contAmp() {
    if (state.tab !== 1) return AMP_FEED;
    if (state.mode === "T") return AMP.T;
    return Math.min(AMP.L, (STRAIN_MAX * SPEED.L) / (2 * Math.PI * state.f));
  }

  // 연속파 한 걸음. 진폭을 한 주기에 걸쳐 올리고 내린다 — 갑자기 시작하거나 멈추면 날카로운 꺾임이 생긴다.
  // 다 멈추면 null
  function contStep(d) {
    const rate = state.f * DT;
    d.env = clamp(d.env + (d.on ? rate : -rate), 0, 1);
    d.phase += 2 * Math.PI * state.f * DT;
    if (!d.on && d.env <= 0) {
      state.drive = null;
      updateContBtn();
      return null;
    }
    return contAmp() * d.env * Math.sin(d.phase);
  }

  // 손잡이 마디의 위치. 손이 놓여 있으면 null (그때는 반사 없는 끝이 된다)
  function driveAt(t) {
    const d = state.drive;
    if (!d) return null;
    if (d.kind === "pulse") {
      // 느린(두꺼운) 줄에서 출발하면 펄스를 그만큼 길게 — 폭을 늘 1 m로 맞춘다.
      // 폭이 좁으면 마디가 성긴 영향을 더 받아 반사·투과 비가 0.5 %쯤 어긋났다 (+0.34 · +1.34)
      const s = (t - d.t0) / (PULSE_SEC * Math.sqrt(mass[I0]));
      if (s >= 1) {
        state.drive = null;
        return 0;
      }
      return AMP[state.mode] * Math.sin(Math.PI * s) ** 2;
    }
    if (d.kind === "cont") {
      const s = contStep(d);
      return s === null ? 0 : s;
    }
    // 끌기, 그리고 손을 놓은 뒤 제자리로 돌아가기.
    // 손 떨림을 부드럽게 하고 빠르기에 상한을 둔다 — 갑자기 튀면 공 사이로 잔물결이 생기고,
    // 종파는 용수철이 한계를 넘어 공끼리 겹친다.
    // ⚠ 놓은 자리에 그대로 두면 안 된다. 양 끝이 모두 흡수하는 끝이라 사슬 전체를 0으로
    //    당겨 줄 힘이 없어서, 손잡이를 올렸다 놓으면 사슬 전체가 그 높이에 떠 버린다.
    const target = d.kind === "drag" ? state.dragTarget : 0;
    const lim = (state.mode === "L" ? STRAIN_MAX : 1.5) * SPEED[state.mode] * DT;
    d.y += clamp((target - d.y) * Math.min(1, DT / 0.05), -lim, lim);
    if (d.kind === "return" && Math.abs(d.y) < 1e-4) {
      state.drive = null;
      return 0;
    }
    return d.y;
  }

  // 왼쪽 끝을 움직이는 것 — { y } 손잡이 위치 · { u } 왼쪽 줄에서 들어오는 파동의 속도 · null 없음
  function sourceAt(t) {
    if (feed()) {
      const d = state.drive;
      const s = contStep(d);
      if (s === null) return null;
      const u = (s - d.s) / DT;
      d.s = s;
      return { u };
    }
    const y0 = driveAt(t);
    return y0 === null ? null : { y: y0 };
  }

  function physicsStep(dt) {
    const k = kappa();
    const src = sourceAt(state.t);
    stepChain(y, vel, mass, rightEnd(), src, k, dt);
    if (state.tab !== 1) stepChain(yR, velR, massR, "absorb", src, k, dt);
    state.t += dt;
    track();
  }

  function stepChain(Y, V, M, end, src, k, dt) {
    const held = !!src && src.y !== undefined;
    if (held) {
      V[I0] = (src.y - Y[I0]) / dt;
      Y[I0] = src.y;
    } else {
      // 손을 놓으면 왼쪽 끝도 반사 없는 끝 — 끝 마디는 질량이 반이라 2배, 완충기 = √(k·m).
      // 연속파는 왼쪽 줄에서 들어오는 파동이 2√(k·m)·u로 민다. 돌아온 파동은 완충기가 그대로 흡수한다
      const m = M[I0];
      const z = Math.sqrt(k * m);
      const push = src ? 2 * z * src.u : 0;
      V[I0] += (2 / m) * (k * (Y[I0 + 1] - Y[I0]) - z * V[I0] + push) * dt;
    }
    for (let i = 1; i < IN; i++) V[i] += (k / M[i]) * (Y[i - 1] - 2 * Y[i] + Y[i + 1]) * dt;

    if (end === "fixed") {
      V[IN] = 0;
    } else {
      const m = M[IN];
      const damp = end === "absorb" ? Math.sqrt(k * m) * V[IN] : 0;   // 자유단은 완충기 없이 그대로 둔다
      V[IN] += (2 / m) * (k * (Y[IN - 1] - Y[IN]) - damp) * dt;
    }
    for (let i = held ? 1 : 0; i < NODES; i++) Y[i] += V[i] * dt;
    if (end === "fixed") Y[IN] = 0;
  }

  // 탭마다 사슬을 다시 짠다 — 탭 3은 가운데에서 두께(질량)가 바뀐다
  function configure() {
    if (state.tab !== 1) state.mode = "T";
    mass.fill(1);
    if (state.tab === 3) {
      const heavy = state.thick ** 2;
      const mL = state.order === "LH" ? 1 : heavy;
      const mR = state.order === "LH" ? heavy : 1;
      for (let i = 0; i < NODES; i++) mass[i] = i < IJ ? mL : i > IJ ? mR : (mL + mR) / 2;
    }
    massR.fill(mass[0]);
    // 카드 그래프 두 칸 + 반사가 일어나는 곳(끝·경계)의 입사파와 실제 변위
    histSrc = state.tab === 1 ? [null, () => y[IP]]
      : state.tab === 2 ? [null, () => y[IP], () => yR[IN], () => y[IN]]
      : [() => y[IA], () => y[IB], () => yR[IJ], () => y[IJ]];
    clearChain();
  }

  /* ---------------------------------------------------------
     재기 — 정해 둔 마디를 펄스가 지나갈 때마다 기록한다.
     시각은 펄스의 무게중심, 높이는 가장 높은 곳(부호 포함).
     ⚠ 시각을 처음엔 꼭대기로 쟀는데, 손으로 들고 버틴 펄스는 꼭대기가 평평해서
        가장 높은 순간이 표시선마다 어긋났다 (2.00이 아니라 2.05 m/s).
        모양이 그대로 이동하는 한 무게중심은 모양과 상관없이 정확히 v로 움직인다.
     --------------------------------------------------------- */
  // area — 펄스가 지나는 동안 변위를 시간으로 더한 값. 높이의 "비"는 이것으로 구한다.
  // 꼭대기 높이는 사슬의 작은 분산 때문에 먼 길을 온 펄스일수록 1 %쯤 낮아지지만(고정단 −0.99),
  // 넓이는 줄지 않아서 반사·투과가 완전하면 비가 정확히 나온다.
  // 펄스 뒤를 따라오는 작은 잔물결까지 넣어야 넓이가 정확하다 — 조용해진 뒤 0.15초를 더 기다렸다가 끝낸다
  const QUIET_SEC = 0.15;
  const probe = (x) => ({ i: node(x), on: false, sw: 0, swt: 0, area: 0, peak: 0, sign: 0, quiet: 0, events: [] });
  let probes = {};
  const measured = { T: null, L: null };   // 탭 1 — 마지막으로 잰 속력 { dt, v }

  function setupProbes() {
    if (state.tab === 1) {
      probes = { m1: probe(MARK_X[0]), m2: probe(MARK_X[1]) };
    } else if (state.tab === 2) {
      probes = { p: probe(P_X) };
    } else {
      probes = {
        a: probe(PROBE_X.A), b: probe(PROBE_X.B),
        a1: probe(SPEED_MARKS.A[0]), a2: probe(SPEED_MARKS.A[1]),
        b1: probe(SPEED_MARKS.B[0]), b2: probe(SPEED_MARKS.B[1]),
      };
    }
  }

  // 탭 2·3은 작은 반사도 잡아야 해서 문턱을 낮춘다
  const probeThr = () => (state.tab === 1 ? 0.15 : 0.02) * AMP[state.mode];

  function runProbe(p, thr) {
    const val = y[p.i];
    const a = Math.abs(val);
    if (!p.on) {
      if (a <= thr) return false;
      p.on = true;
      p.sw = 0;
      p.swt = 0;
      p.area = 0;
      p.peak = 0;
      p.quiet = 0;
      p.sign = Math.sign(val);
    }
    p.area += val * DT;
    if (Math.sign(val) === p.sign) {
      p.sw += a;
      p.swt += a * state.t;
      if (a > Math.abs(p.peak)) p.peak = val;
    }
    p.quiet = a < thr * 0.5 ? p.quiet + DT : 0;
    if (p.quiet >= QUIET_SEC) {
      p.on = false;
      p.events.push({ t: p.swt / p.sw, peak: p.peak, area: p.area });
      if (p.events.length > 8) p.events.shift();
      return true;
    }
    return false;
  }

  function track() {
    const thr = probeThr();
    for (const key in probes) {
      const done = runProbe(probes[key], thr);
      if (done && state.tab === 1 && key === "m2") measureTab1();
    }
    trackHist();
    trackPeriod();
  }

  function measureTab1() {
    if (isCont()) return;
    const ev2 = probes.m2.events;
    const e2 = ev2[ev2.length - 1];
    const e1 = [...probes.m1.events].reverse().find((e) => e.t < e2.t && Math.sign(e.peak) === Math.sign(e2.peak));
    if (!e1) return;
    const dx = MARK_X[1] - MARK_X[0];
    const dt = e2.t - e1.t;
    // 같은 펄스끼리만 짝짓는다 — 걸린 시간이 터무니없으면 버린다
    const expect = dx / SPEED[state.mode];
    if (dt < expect / 2 || dt > expect * 2) return;
    measured[state.mode] = { dt, v: dx / dt };
  }

  // 두 표시선을 같은 펄스가 처음 지난 시각으로 속력을 잰다 (탭 3)
  function speedBetween(p1, p2, xs) {
    const a = p1.events[0];
    const b = p2.events[0];
    if (!a || !b || b.t <= a.t) return null;
    return (xs[1] - xs[0]) / (b.t - a.t);
  }

  /* 변위 기록 — 0·1 카드 그래프, 2·3 반사가 일어나는 곳의 입사파와 실제 변위 */
  const hist = [0, 1, 2, 3].map(() => new Float64Array(Math.round(STRIP_SEC / STRIP_DT)));
  let histSrc = [];
  let histHead = 0;
  let histTick = 0;

  // 걸음 수로 센다 — 시각을 비교하면 소수 오차로 기록이 가끔 한 걸음(1 ms) 늦어져 주기가 어긋났다
  function trackHist() {
    if (histTick++ % Math.round(STRIP_DT / DT)) return;
    hist.forEach((h, k) => { h[histHead] = histSrc[k] ? histSrc[k]() : 0; });
    histHead = (histHead + 1) % hist[0].length;
  }

  const histAt = (k, back) => hist[k][(histHead - back + hist[k].length) % hist[k].length];   // back = 1이 가장 최근

  /* 연속파 재기 — 최근 sec초의 기록으로 */
  function histAmp(k, sec) {
    const n = Math.round(sec / STRIP_DT);
    let s = 0;
    for (let j = 1; j <= n; j++) s += histAt(k, j) ** 2;
    return Math.sqrt((2 * s) / n);
  }

  // 기록 a가 기록 b의 몇 배인지 — 같은 위상이면 +, 반대 위상이면 −
  function histRatio(a, b, sec) {
    const n = Math.round(sec / STRIP_DT);
    let ab = 0;
    let bb = 0;
    for (let j = 1; j <= n; j++) {
      const vb = histAt(b, j);
      ab += histAt(a, j) * vb;
      bb += vb * vb;
    }
    return bb > 1e-12 ? ab / bb : null;
  }

  // 주기 — 위로 지나가는 영점 사이 시간의 평균
  function histPeriod(k, sec) {
    const n = Math.min(hist[k].length - 2, Math.round(sec / STRIP_DT));
    let first = null;
    let last = null;
    let count = 0;
    for (let j = n; j >= 1; j--) {
      const a = histAt(k, j + 1);
      const b = histAt(k, j);
      if (a < 0 && b >= 0) {
        const at = -(j + 1) + a / (a - b);
        if (first === null) first = at;
        last = at;
        count++;
      }
    }
    return count >= 2 ? ((last - first) / (count - 1)) * STRIP_DT : null;
  }

  // 파장 — 한순간의 줄 모양에서 이웃한 마루와 골 사이 거리의 두 배를 평균
  function lambdaOf(Y, x0, x1) {
    const i0 = node(x0) + 1;
    const i1 = node(x1) - 1;
    let amp = 0;
    for (let i = i0; i <= i1; i++) amp = Math.max(amp, Math.abs(Y[i]));
    if (amp < 0.02) return null;
    const ext = [];
    for (let i = i0; i <= i1; i++) {
      const a = Y[i - 1];
      const b = Y[i];
      const c = Y[i + 1];
      if (Math.abs(b) < 0.5 * amp) continue;
      if ((b > a && b >= c) || (b < a && b <= c)) {
        const den = a - 2 * b + c;
        ext.push({ x: (i + (den !== 0 ? (0.5 * (a - c)) / den : 0)) * DX, s: Math.sign(b) });
      }
    }
    const halves = [];
    for (let k = 1; k < ext.length; k++) {
      if (ext[k].s !== ext[k - 1].s) halves.push(ext[k].x - ext[k - 1].x);
    }
    return halves.length ? (2 * halves.reduce((s, h) => s + h, 0)) / halves.length : null;
  }

  // 연속파가 자리 잡았는지 — 파면이 닿는 시간(sec) + 진폭을 올리는 한 주기가 지났는가.
  // 속력은 기다릴 시간을 정하는 데만 쓴다. 보여 주는 값은 모두 줄에서 잰다
  const settled = (sec) => isCont() && state.drive.on && state.t - state.contSince >= sec + 1 / state.f;
  const lamHold = [null, null];   // 마루가 하나만 보이는 순간이 있어서 마지막으로 잰 파장을 들고 있는다

  function holdLambda(k, ok, Y, x0, x1) {
    if (!ok) {
      lamHold[k] = null;
      return null;
    }
    const lam = lambdaOf(Y, x0, x1);
    if (lam) lamHold[k] = lam;
    return lamHold[k];
  }

  function recentRange(k, sec) {
    const h = hist[k];
    const n = Math.round(sec / STRIP_DT);
    let lo = Infinity;
    let hi = -Infinity;
    for (let j = 1; j <= n; j++) {
      const v = h[(histHead - j + h.length) % h.length];
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    return [lo, hi];
  }

  /* 탭 1 — 점 P의 주기 (위로 지나가는 영점 사이 시간) */
  let pPrev = 0;
  const pCross = [];

  function trackPeriod() {
    if (state.tab !== 1) return;
    const yp = y[IP];
    if (pPrev < 0 && yp >= 0 && Math.abs(yp - pPrev) > 1e-9) {
      pCross.push(state.t - DT * (yp / (yp - pPrev)));
      if (pCross.length > 6) pCross.shift();
    }
    pPrev = yp;
  }

  function measuredPeriod() {
    if (!isCont() || pCross.length < 3) return null;
    const n = pCross.length;
    const T = (pCross[n - 1] - pCross[n - 3]) / 2;
    if (state.t - pCross[n - 1] > 1.5 * T) return null;
    return T;
  }

  /* 탭 1 연속파의 파장 — 이웃한 마루와 골 사이 거리의 두 배를 평균 */
  function measureLambda() {
    if (state.tab !== 1 || !isCont()) return null;
    const A = contAmp();
    const ext = [];
    for (let i = node(0.4) + 1; i < node(5.8); i++) {
      const a = y[i - 1];
      const b = y[i];
      const c = y[i + 1];
      if (Math.abs(b) < 0.5 * A) continue;
      if ((b > a && b >= c) || (b < a && b <= c)) {
        const den = a - 2 * b + c;
        const off = den !== 0 ? (0.5 * (a - c)) / den : 0;
        ext.push({ x: (i + off) * DX, s: Math.sign(b) });
      }
    }
    const halves = [];
    for (let k = 1; k < ext.length; k++) {
      if (ext[k].s !== ext[k - 1].s) halves.push(ext[k].x - ext[k - 1].x);
    }
    if (!halves.length) return null;
    const lambda = (2 * halves.reduce((s, h) => s + h, 0)) / halves.length;
    // 그림에 표시할 마루 두 개 — 가운데 가까운 것
    const crests = ext.filter((e) => e.s > 0);
    let pair = null;
    for (let k = 1; k < crests.length; k++) {
      const p = [crests[k - 1], crests[k]];
      if (!pair || Math.abs((p[0].x + p[1].x) / 2 - L / 2) < Math.abs((pair[0].x + pair[1].x) / 2 - L / 2)) pair = p;
    }
    return { lambda, pair };
  }

  /* ---------------------------------------------------------
     그리기
     --------------------------------------------------------- */
  function geom(w, h) {
    const left = 64;
    const right = 30;
    const ppm = (w - left - right) / L;
    const chainY = state.mode === "T" ? Math.round(h * 0.46) : Math.round(h * 0.3);
    return { w, h, ppm, chainY, X: (x) => left + x * ppm };
  }

  function beadPos(g, i) {
    const x0 = i * DX;
    if (state.mode === "T") return [g.X(x0), g.chainY - y[i] * g.ppm];
    return [g.X(x0 + y[i]), g.chainY];
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

  function label(ctx, text, x, y0, color, size = 12, align = "center", weight = "500", mono = false) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${mono ? "'Geist Mono', monospace" : "Geist, 'Malgun Gothic', sans-serif"}`;
    ctx.textAlign = align;
    ctx.fillText(text, x, y0);
    ctx.restore();
  }

  const hexRgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  function mix(a, b, t) {
    const p = hexRgb(a);
    const q = hexRgb(b);
    return `rgb(${p.map((v, k) => Math.round(v + (q[k] - v) * t)).join(",")})`;
  }

  function beadColor(val) {
    if (state.mode !== "T") return COLOR_BEAD;
    const t = clamp(Math.abs(val) / (0.6 * AMP.T), 0, 1);
    return mix(COLOR_BEAD, val > 0 ? COLOR_UP : COLOR_DOWN, t);
  }

  // 용수철 — 두 공 사이를 지그재그로. 종파에서는 줄어들면 촘촘해진다
  function zigzag(ctx, x1, y1, x2, y2, turns, amp) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const n = turns * 2;
    ctx.moveTo(x1, y1);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const s = k % 2 ? amp : -amp;
      ctx.lineTo(x1 + dx * t + nx * s, y1 + dy * t + ny * s);
    }
    ctx.lineTo(x2, y2);
  }

  function drawMarks(ctx, g, top, bottom) {
    ctx.save();
    ctx.strokeStyle = "#cfcfcf";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    MARK_X.forEach((x, k) => {
      const px = Math.round(g.X(x)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, top);
      ctx.lineTo(px, bottom);
      ctx.stroke();
      label(ctx, `${k ? "②" : "①"} ${x} m`, px, top - 6, COLOR_MUTE, 12);
    });
    ctx.restore();
  }

  const rulerY = (g) => g.chainY + DRAG_MAX.T * g.ppm + 32;

  function drawRuler(ctx, g, yr) {
    ctx.save();
    ctx.strokeStyle = "#d4d4d4";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g.X(0), yr + 0.5);
    ctx.lineTo(g.X(L), yr + 0.5);
    for (let x = 0; x <= L + 1e-9; x += 0.5) {
      const px = Math.round(g.X(x)) + 0.5;
      const big = Math.abs(x - Math.round(x)) < 1e-9;
      ctx.moveTo(px, yr);
      ctx.lineTo(px, yr + (big ? 8 : 4));
    }
    ctx.stroke();
    ctx.restore();
    for (let x = 0; x <= L; x++) label(ctx, `${x}`, g.X(x), yr + 21, COLOR_MUTE, 11, "center", "400", true);
    label(ctx, "m", g.X(L) + 14, yr + 21, COLOR_MUTE, 11, "left", "400", true);
  }

  // 줄의 두께 = √질량 (질량이 두께의 제곱이므로). 공 반지름과 용수철 굵기를 두께에 비례하게.
  // 탭 3은 가장 두꺼운 공도 이웃 공과 겹치지 않게 기준 크기를 줄인다 (render에서 정한다)
  let beadBase = 4.8;
  const thickAt = (i) => Math.sqrt(mass[i]);
  const beadR = (i) => beadBase * thickAt(i);

  // 용수철 한 칸의 굵기와 지그재그 폭
  function springLook(i) {
    const d = (thickAt(i) + thickAt(Math.min(i + BEAD_EVERY, IN))) / 2;
    return { lw: 1.3 * (1 + 0.75 * (d - 1)), amp: 3.5 * (beadBase / 4.8) * d };
  }

  // 끝 너머로 사슬이 계속 이어진다는 표시 — 오른쪽 끝(반사 없음), 탭 2·3 연속파의 왼쪽 끝
  function drawContinuation(ctx, i, x1, x2, yy) {
    const s = springLook(i);
    const grad = ctx.createLinearGradient(x1, 0, x2, 0);
    grad.addColorStop(0, COLOR_SPRING);
    grad.addColorStop(1, "rgba(189,189,189,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = s.lw;
    ctx.beginPath();
    zigzag(ctx, x1, yy, x2, yy, 5, s.amp);
    ctx.stroke();
  }

  function drawChain(ctx, g) {
    const end = rightEnd();
    if (end === "absorb") {
      const [ex, ey] = beadPos(g, IN);
      drawContinuation(ctx, IN - BEAD_EVERY, ex, g.w, ey);
    }

    ctx.strokeStyle = COLOR_SPRING;
    for (let i = 0; i + BEAD_EVERY < NODES; i += BEAD_EVERY) {
      const [x1, y1] = beadPos(g, i);
      const [x2, y2] = beadPos(g, i + BEAD_EVERY);
      const s = springLook(i);
      ctx.lineWidth = s.lw;
      ctx.beginPath();
      zigzag(ctx, x1, y1, x2, y2, 3, s.amp);
      ctx.stroke();
    }

    const last = end === "absorb" ? NODES : IN;   // 고정단·자유단의 끝 마디는 따로 그린다
    for (let i = BEAD_EVERY; i < last; i += BEAD_EVERY) {
      const [bx, by] = beadPos(g, i);
      ctx.fillStyle = beadColor(y[i]);
      ctx.beginPath();
      ctx.arc(bx, by, beadR(i), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 종파 — 용수철이 가장 줄어든 곳(밀)과 가장 늘어난 곳(소)에 글자를 띄운다 (교과서 그림 III-7)
  function drawDensity(ctx, g) {
    const thr = 0.12;
    let lastX = -Infinity;
    for (let i = 1; i < IN - 1; i++) {
      const s0 = (y[i] - y[i - 1]) / DX;
      const s1 = (y[i + 1] - y[i]) / DX;
      const s2 = (y[i + 2] - y[i + 1]) / DX;
      const dense = s1 < -thr && s1 <= s0 && s1 < s2;
      const sparse = s1 > thr && s1 >= s0 && s1 > s2;
      if (!dense && !sparse) continue;
      const x = (i + 0.5) * DX + (y[i] + y[i + 1]) / 2;
      if (x - lastX < 0.4) continue;
      lastX = x;
      label(ctx, dense ? "밀" : "소", g.X(x), g.chainY - 30, dense ? COLOR_INK : COLOR_MUTE, 13, "center", "600");
    }
  }

  // 관찰점 — 동그라미와, 최근 3초 동안 움직인 범위 (제자리에서만 움직인다는 것)
  function drawProbe(ctx, g, i, k, name) {
    const [px, py] = beadPos(g, i);
    const [lo, hi] = recentRange(k, 3);
    const x0 = g.X(i * DX);
    ctx.save();
    ctx.strokeStyle = "rgba(23,23,23,0.35)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    if (hi - lo > 0.005) {
      ctx.beginPath();
      if (state.mode === "T") {
        ctx.moveTo(x0, g.chainY - hi * g.ppm);
        ctx.lineTo(x0, g.chainY - lo * g.ppm);
      } else {
        ctx.moveTo(g.X(i * DX + lo), g.chainY + 16);
        ctx.lineTo(g.X(i * DX + hi), g.chainY + 16);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = COLOR_INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, beadR(i) + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    label(ctx, name, px, py - beadR(i) - 10, COLOR_INK, 14, "center", "600");
  }

  function drawHandle(ctx, g) {
    const [hx, hy] = beadPos(g, 0);
    ctx.save();
    ctx.fillStyle = state.drive && state.drive.kind === "drag" ? COLOR_INK : "#2b2b2b";
    if (state.mode === "T") roundRect(ctx, hx - 9, hy - 20, 14, 40, 5);
    else roundRect(ctx, hx - 26, hy - 9, 30, 18, 5);
    ctx.fill();
    ctx.restore();
    label(ctx, "손잡이", hx - 2, state.mode === "T" ? hy + 36 : hy + 28, COLOR_MUTE, 11);
  }

  // 탭 2·3 연속파 — 손잡이 대신 왼쪽으로 이어진 줄. 파동이 여기로 들어오고 반사파는 여기로 빠져나간다
  function drawFeed(ctx, g) {
    const [hx, hy] = beadPos(g, 0);
    ctx.save();
    drawContinuation(ctx, 0, hx, 0, hy);
    ctx.fillStyle = beadColor(y[0]);
    ctx.beginPath();
    ctx.arc(hx, hy, beadR(0), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 탭 2·3 연속파 — 입사파(점선)와 반사파(보라)를 따로 그린다. 둘을 더하면 실제 줄이다
  function drawParts(ctx, g) {
    const last = state.tab === 3 ? IJ : IN;
    const line = (val) => {
      ctx.beginPath();
      for (let i = 0; i <= last; i++) {
        const px = g.X(i * DX);
        const py = g.chainY - val(i) * g.ppm;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    };
    ctx.save();
    ctx.lineJoin = "round";
    ctx.strokeStyle = COLOR_REFL;
    ctx.lineWidth = 2.5;
    line((i) => y[i] - yR[i]);
    ctx.strokeStyle = COLOR_INC;   // 겹치는 곳에서도 둘 다 보이게 점선을 위에
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    line((i) => yR[i]);
    ctx.restore();
  }

  // 탭 2 — 오른쪽 끝. 고정단은 벽, 자유단은 막대에 끼운 고리
  // 자유단 고리는 펄스 높이의 두 배까지 올라간다 — 벽·막대를 무대 위 끝부터 눈금자 위까지 세운다
  function drawEnd(ctx, g) {
    const xe = g.X(L);
    const [bx, by] = beadPos(g, IN);
    const top = -2;
    const bottom = rulerY(g) - 12;
    ctx.save();
    if (state.end === "fixed") {
      ctx.fillStyle = "#f2f2f2";
      ctx.strokeStyle = COLOR_INK;
      ctx.lineWidth = 1.5;
      ctx.fillRect(xe + 2, top, 14, bottom - top);
      ctx.strokeRect(xe + 2, top, 14, bottom - top);
      ctx.strokeStyle = "#c8c8c8";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let yy = top + 8; yy < bottom; yy += 12) {
        ctx.moveTo(xe + 3, yy + 6);
        ctx.lineTo(xe + 15, yy - 6);
      }
      ctx.stroke();
      ctx.fillStyle = COLOR_INK;
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, Math.PI * 2);
      ctx.fill();
      drawReaction(ctx, g, bx, by);
    } else {
      ctx.strokeStyle = "#9e9e9e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xe, top);
      ctx.lineTo(xe, bottom);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = beadColor(y[IN]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(bx, by, 5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    label(ctx, state.end === "fixed" ? "벽 (고정단)" : "막대에 끼운 고리 (자유단)", xe - 12, 24, COLOR_BODY, 13, "right", "600");
  }

  // 고정단 — 펄스가 벽에 닿으면 벽이 줄을 반대쪽으로 당긴다 (교과서가 위상 반전을 설명하는 힘)
  function drawReaction(ctx, g, bx, by) {
    const slope = (y[IN - 1] - y[IN]) / DX;
    if (Math.abs(slope) < 0.08) return;
    const len = clamp(Math.abs(slope) * 45, 0, 90);
    const d = slope > 0 ? 1 : -1;   // 줄이 위로 올라가 있으면 벽은 아래로 당긴다
    const y2 = by + d * len;
    ctx.save();
    ctx.strokeStyle = COLOR_INK;
    ctx.fillStyle = COLOR_INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx - 12, by);
    ctx.lineTo(bx - 12, y2 - d * 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx - 12, y2);
    ctx.lineTo(bx - 17, y2 - d * 10);
    ctx.lineTo(bx - 7, y2 - d * 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    label(ctx, "벽이 줄을 당기는 힘", bx - 20, y2 + (d > 0 ? 14 : -6), COLOR_INK, 12, "right", "600");
  }

  // 탭 3 — 두 줄의 경계와 이름
  function drawMedia(ctx, g) {
    const xj = Math.round(g.X(JOIN_X)) + 0.5;
    const span = (DRAG_MAX.T + 0.05) * g.ppm;
    ctx.save();
    ctx.strokeStyle = "#cfcfcf";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(xj, g.chainY - span);
    ctx.lineTo(xj, g.chainY + span);
    ctx.stroke();
    ctx.restore();
    const light = "얇은 줄 · 빠름";
    const heavy = "두꺼운 줄 · 느림";
    const lightLeft = state.order === "LH";
    const yy = g.chainY - span - 8;
    label(ctx, lightLeft ? light : heavy, g.X(JOIN_X / 2), yy, COLOR_BODY, 13, "center", "600");
    label(ctx, lightLeft ? heavy : light, g.X((JOIN_X + L) / 2), yy, COLOR_BODY, 13, "center", "600");
    label(ctx, "경계", xj, g.chainY + span + 16, COLOR_MUTE, 11);
  }

  function drawLambda(ctx, g, lam) {
    if (!lam || !lam.pair) return;
    const [a, b] = lam.pair;
    const A = AMP[state.mode];
    const yy = state.mode === "T" ? g.chainY - A * g.ppm - 24 : g.graphMid - A * g.gScale - 20;
    const x1 = g.X(a.x);
    const x2 = g.X(b.x);
    ctx.save();
    ctx.strokeStyle = COLOR_INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, yy); ctx.lineTo(x2, yy);
    ctx.moveTo(x1, yy - 6); ctx.lineTo(x1, yy + 6);
    ctx.moveTo(x2, yy - 6); ctx.lineTo(x2, yy + 6);
    ctx.stroke();
    ctx.restore();
    label(ctx, `λ = ${lam.lambda.toFixed(2)} m`, (x1 + x2) / 2, yy - 9, COLOR_INK, 13, "center", "600");
  }

  // 종파 — 사슬 아래에 변위 그래프 (교과서 112쪽 그림 III-20과 같은 표현)
  function drawLongGraph(ctx, g) {
    const top = g.chainY + 78;
    const bottom = g.h - 52;
    g.graphMid = (top + bottom) / 2;
    g.gScale = (bottom - top) / 2 / (AMP.L * 1.3);
    ctx.save();
    ctx.strokeStyle = COLOR_AXIS;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g.X(0), g.graphMid + 0.5);
    ctx.lineTo(g.X(L), g.graphMid + 0.5);
    ctx.stroke();
    ctx.strokeStyle = COLOR_INK;
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    for (let i = 0; i < NODES; i++) {
      const px = g.X(i * DX);
      const py = g.graphMid - y[i] * g.gScale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
    label(ctx, "변위 (오른쪽 +)", g.X(0), top - 6, COLOR_MUTE, 11, "left");
  }

  function render() {
    const { w, h, ctx } = SimUtils.fitCanvas(canvas);
    const g = geom(w, h);
    lastG = g;
    beadBase = state.tab === 3 ? Math.min(4.8, 0.0155 * g.ppm) : 4.8;   // 두께 3배 공의 지름 ≤ 공 간격의 93 %
    ctx.fillStyle = COLOR_STAGE;
    ctx.fillRect(0, 0, w, h);

    const lam = measureLambda();
    if (state.mode === "T") {
      if (state.tab === 1) drawMarks(ctx, g, g.chainY - DRAG_MAX.T * g.ppm - 34, g.chainY + DRAG_MAX.T * g.ppm + 10);
      drawRuler(ctx, g, rulerY(g));
    } else {
      drawMarks(ctx, g, g.chainY - 46, g.chainY + 30);
      drawRuler(ctx, g, g.chainY + 36);
      drawLongGraph(ctx, g);
    }
    if (state.tab === 3) drawMedia(ctx, g);
    drawChain(ctx, g);
    if (state.tab === 2) drawEnd(ctx, g);
    if (state.mode === "L") drawDensity(ctx, g);
    if (state.tab === 3) {
      drawProbe(ctx, g, IA, 0, "A");
      drawProbe(ctx, g, IB, 1, "B");
    } else if (!feed()) {
      drawProbe(ctx, g, IP, 1, "P");
    }
    if (feed()) {
      drawFeed(ctx, g);
      if (state.parts) drawParts(ctx, g);
    } else {
      drawHandle(ctx, g);
    }
    drawLambda(ctx, g, lam);
    if (state.tab !== 2) label(ctx, "오른쪽 끝: 계속 이어짐 (반사 없음)", w - 18, 24, COLOR_MUTE, 12, "right");
    return lam;
  }

  function drawStrip(cv, k) {
    const { w, h, ctx } = SimUtils.fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const mid = Math.round(h / 2) + 0.5;
    const amp = (h * 0.42) / (AMP[state.mode] * 1.2);
    ctx.strokeStyle = COLOR_AXIS;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();
    const n = hist[0].length;
    const series = (val, color, width, dash) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.beginPath();
      for (let j = 0; j < n; j++) {
        const px = (j / (n - 1)) * w;
        const py = mid - clamp(val((histHead + j) % n) * amp, -h / 2 + 1, h / 2 - 1);
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };
    if (state.tab === 2 && k === 1 && state.cards === "cont") {
      // 끝에서 입사파(점선)와 반사파(보라) — 고정단은 늘 반대, 자유단은 늘 같이 움직인다.
      // 자유단은 두 선이 겹치므로 점선을 위에 그린다
      series((j) => hist[3][j] - hist[2][j], COLOR_REFL, 1.8, []);
      series((j) => hist[2][j], COLOR_INC, 1.5, [4, 3]);
    } else {
      series((j) => hist[k][j], COLOR_INK, 1.6, []);
    }
  }

  /* ---------------------------------------------------------
     카드 — 탭마다 내용을 바꿔 끼운다
     --------------------------------------------------------- */
  function cardsTab1(lam) {
    const m = measured[state.mode];
    const T = measuredPeriod();
    const rec = ["T", "L"].filter((k) => measured[k]).map((k) => `${MODE_NAME[k]} ${measured[k].v.toFixed(2)}`);
    return [
      {
        name: "파동", tag: { text: MODE_NAME[state.mode] },
        sym: "v", val: m ? m.v.toFixed(2) : null, unit: "m/s",
        rows: [
          { k: "λ", v: lam ? `${lam.lambda.toFixed(2)} m` : "–" },
          { k: "λ ÷ T", v: lam && T ? `${(lam.lambda / T).toFixed(2)} m/s` : "–" },
        ],
        strip: false,
        f1: m
          ? `①→② ${(MARK_X[1] - MARK_X[0]).toFixed(2)} m ÷ ${m.dt.toFixed(3)} s = ${m.v.toFixed(2)} m/s`
          : "펄스를 보내면 ①→②를 지나는 시간으로 속력을 잰다",
        f2: rec.length ? `잰 속력 · ${rec.join(" · ")} m/s` : "횡파와 종파를 각각 재서 비교해 보자",
      },
      {
        name: "점 P", tag: { text: "제자리에서 진동" },
        sym: "T", val: T ? T.toFixed(2) : null, unit: "s",
        rows: [
          { k: "평형 위치", v: "2.00 m" },
          { k: "변위", v: `${signed(y[IP])} m` },
        ],
        strip: true,
        f1: "P가 한 번 진동하는 동안 파동은 한 파장만큼 나아간다",
        f2: "",
      },
    ];
  }

  function cardsTab2() {
    if (state.cards === "cont") return cardsTab2Cont();
    const ev = probes.p.events;
    const inc = ev[0] || null;
    const ref = ev[1] || null;
    const ratio = inc && ref ? ref.area / inc.area : null;
    const inverted = ratio != null && ratio < 0;
    const fixed = state.end === "fixed";
    return [
      {
        name: "들어간 펄스",
        tag: inc ? { text: inc.peak > 0 ? "위로" : "아래로", cls: signCls(inc.peak) } : null,
        sym: "", val: inc ? signed(inc.peak) : null, valCls: inc ? signCls(inc.peak) : "", unit: "m",
        rows: [
          { k: "잰 곳", v: "점 P (2 m)" },
          { k: "오른쪽 끝", v: END_NAME[state.end] },
        ],
        strip: false,
        f1: inc ? "오른쪽으로 가며 점 P를 지날 때의 높이" : "펄스를 보내면 점 P를 지날 때 높이를 잰다",
        f2: "",
      },
      {
        name: "돌아온 펄스",
        tag: ref ? { text: inverted ? "뒤집힘" : "그대로", cls: signCls(ref.peak) } : null,
        sym: "", val: ref ? signed(ref.peak) : null, valCls: ref ? signCls(ref.peak) : "", unit: "m",
        rows: [
          { k: "높이 비", v: ratio != null ? signed(ratio) : "–", cls: ratio != null ? signCls(ratio) : "" },
          { k: "위상", v: ref ? (inverted ? "반대" : "같음") : "–" },
        ],
        strip: true,
        f1: fixed ? "고정단 — 벽이 줄을 반대로 당겨 위상이 바뀐다" : "자유단 — 끝이 올라갔다 내려와 위상이 그대로다",
        f2: "",
      },
    ];
  }

  // 탭 2 연속파 — 끝에서 입사파와 반사파를 비교한다
  function cardsTab2Cont() {
    const win = 2 / state.f;
    const reach = L / SPEED.T;
    const ok = settled(reach + win);
    const lam = holdLambda(0, settled(5.8 / SPEED.T), yR, 0.4, 5.8);
    const T = ok ? histPeriod(2, win) : null;
    const A = ok ? histAmp(2, win) : null;
    const R = ok ? histRatio(3, 2, win) - 1 : null;   // (실제 − 입사) ÷ 입사
    const endAmp = ok ? histAmp(3, win) : null;
    const fixed = state.end === "fixed";
    return [
      {
        name: "들어간 파동", tag: { text: "입사파" },
        sym: "A", val: A != null ? A.toFixed(2) : null, unit: "m",
        rows: [
          { k: "파장", v: lam ? `${lam.toFixed(2)} m` : "–" },
          { k: "진동수", v: T ? `${(1 / T).toFixed(2)} Hz` : "–" },
        ],
        strip: false,
        f1: lam && T ? `v = fλ = ${(lam / T).toFixed(2)} m/s` : "파동이 끝까지 갔다 오면 잰다",
        f2: "",
      },
      {
        name: "돌아온 파동",
        tag: R != null ? { text: R < 0 ? "뒤집힘" : "그대로", cls: signCls(R) } : null,
        sym: "", val: R != null ? signed(R) : null, valCls: R != null ? signCls(R) : "", unit: "배",
        rows: [
          { k: "위상", v: R != null ? (R < 0 ? "반대" : "같음") : "–" },
          { k: "끝의 진폭", v: endAmp != null ? `${endAmp.toFixed(2)} m` : "–" },
        ],
        strip: true,
        f1: fixed ? "고정단 — 끝에서 입사파와 반사파가 늘 반대로 움직인다" : "자유단 — 끝에서 입사파와 반사파가 늘 같이 움직인다",
        f2: "",
      },
    ];
  }

  // 탭 3 연속파 — 경계에서 입사파와 비교한 반사·투과, 그리고 양쪽 줄의 파장과 진동수
  function cardsTab3Cont() {
    const win = 2 / state.f;
    const vL = SPEED.T / Math.sqrt(mass[0]);
    const vR = SPEED.T / Math.sqrt(mass[IN]);
    const toJoin = JOIN_X / vL;
    const Tt = settled(toJoin + win) ? histRatio(3, 2, win) : null;   // 경계의 실제 변위 ÷ 입사파
    const R = Tt != null ? Tt - 1 : null;
    const none = R != null && Math.abs(R) < 0.005;
    const lamL = holdLambda(0, settled(toJoin), yR, 0.3, JOIN_X);
    const lamR = holdLambda(1, settled(toJoin + (L - 0.2 - JOIN_X) / vR), y, JOIN_X + 0.15, L - 0.2);
    const TA = settled((2 * JOIN_X - PROBE_X.A) / vL + win) ? histPeriod(0, win) : null;
    const TB = settled(toJoin + (PROBE_X.B - JOIN_X) / vR + win) ? histPeriod(1, win) : null;
    const lightLeft = state.order === "LH";
    const nameL = lightLeft ? "얇은 줄" : "두꺼운 줄";
    const nameR = lightLeft ? "두꺼운 줄" : "얇은 줄";
    const speedLine = (name, lam, T) => (lam && T ? `${name} v = fλ = ${(lam / T).toFixed(2)} m/s` : "경계에서 입사파와 비교한 진폭 비");
    return [
      {
        name: "반사파",
        tag: R == null ? null : none ? { text: "없음" } : { text: R < 0 ? "뒤집힘" : "그대로", cls: signCls(R) },
        sym: "", val: R == null ? null : none ? "0.00" : signed(R), valCls: R == null || none ? "" : signCls(R), unit: "배",
        rows: [
          { k: `${nameL} 파장`, v: lamL ? `${lamL.toFixed(2)} m` : "–" },
          { k: "진동수", v: TA ? `${(1 / TA).toFixed(2)} Hz` : "–" },
        ],
        strip: true,
        f1: speedLine(nameL, lamL, TA),
        f2: "",
      },
      {
        name: "투과파",
        tag: Tt != null ? { text: Tt < 0 ? "뒤집힘" : "그대로", cls: signCls(Tt) } : null,
        sym: "", val: Tt != null ? signed(Tt) : null, valCls: Tt != null ? signCls(Tt) : "", unit: "배",
        rows: [
          { k: `${nameR} 파장`, v: lamR ? `${lamR.toFixed(2)} m` : "–" },
          { k: "진동수", v: TB ? `${(1 / TB).toFixed(2)} Hz` : "–" },
        ],
        strip: true,
        f1: speedLine(nameR, lamR, TB),
        f2: "",
      },
    ];
  }

  function cardsTab3() {
    if (state.cards === "cont") return cardsTab3Cont();
    const a = probes.a.events;
    const inc = a[0] || null;
    const ref = a[1] || null;
    const tr = probes.b.events[0] || null;
    const R = inc && ref ? ref.area / inc.area : null;
    const Tt = inc && tr ? tr.area / inc.area : null;
    // 반사가 올 시간이 한참 지났는데도 없으면 "없음" — 질량 비가 1이면 정말로 반사가 없다
    const vA = SPEED.T / Math.sqrt(mass[0]);
    const noRefl = inc && !ref && state.t - inc.t > (2 * (JOIN_X - PROBE_X.A)) / vA + 1.0;
    const vLeft = speedBetween(probes.a1, probes.a2, SPEED_MARKS.A);
    const vRight = speedBetween(probes.b1, probes.b2, SPEED_MARKS.B);
    const lightLeft = state.order === "LH";
    const nameL = lightLeft ? "얇은 줄" : "두꺼운 줄";
    const nameR = lightLeft ? "두꺼운 줄" : "얇은 줄";
    return [
      {
        name: "반사 펄스",
        tag: ref ? { text: R < 0 ? "뒤집힘" : "그대로", cls: signCls(ref.peak) } : noRefl ? { text: "없음" } : null,
        sym: "", val: R != null ? signed(R) : noRefl ? "0.00" : null, valCls: R != null ? signCls(R) : "", unit: "배",
        rows: [
          { k: "들어간 펄스", v: inc ? `${signed(inc.peak)} m` : "–", cls: inc ? signCls(inc.peak) : "" },
          { k: "돌아온 펄스", v: ref ? `${signed(ref.peak)} m` : noRefl ? "없음" : "–", cls: ref ? signCls(ref.peak) : "" },
        ],
        strip: true,
        f1: "A(1.5 m)에서 잼 · 들어간 펄스 높이에 대한 비",
        f2: "",
      },
      {
        name: "투과 펄스",
        tag: tr ? { text: Tt < 0 ? "뒤집힘" : "그대로", cls: signCls(tr.peak) } : null,
        sym: "", val: Tt != null ? signed(Tt) : null, valCls: Tt != null ? signCls(Tt) : "", unit: "배",
        rows: [
          { k: `${nameL} 속력`, v: vLeft ? `${vLeft.toFixed(2)} m/s` : "–" },
          { k: `${nameR} 속력`, v: vRight ? `${vRight.toFixed(2)} m/s` : "–" },
        ],
        strip: true,
        f1: "B(4.5 m)에서 잼 · 속력은 각 줄의 1.5 m 구간을 지나는 시간으로",
        f2: "",
      },
    ];
  }

  function applyCard(el, m) {
    el.name.textContent = m.name;
    el.tag.textContent = m.tag ? m.tag.text : "";
    el.tag.className = "obs-tag " + (m.tag && m.tag.cls ? m.tag.cls : "");
    el.fbox.className = "obs-f " + (m.val == null ? "is-empty" : m.valCls || "");
    el.sym.textContent = m.sym || "";
    el.val.textContent = m.val == null ? "–" : m.val;
    el.unit.textContent = m.unit || "";
    m.rows.forEach((r, i) => {
      el.k[i].textContent = r.k;
      el.v[i].textContent = r.v;
      el.v[i].className = r.cls || "";
    });
    el.strip.classList.toggle("hidden", !m.strip);
    el.f1.textContent = m.f1 || "";
    el.f1.classList.toggle("hidden", !m.f1);
    el.f2.textContent = m.f2 || "";
    el.f2.classList.toggle("hidden", !m.f2);
  }

  function updateCards(lam) {
    const models = state.tab === 1 ? cardsTab1(lam) : state.tab === 2 ? cardsTab2() : cardsTab3();
    cardEls.forEach((el, i) => applyCard(el, models[i]));
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

  function clearChain() {
    y.fill(0);
    vel.fill(0);
    yR.fill(0);
    velR.fill(0);
    hist.forEach((h) => h.fill(0));
    lamHold.fill(null);
    pCross.length = 0;
    pPrev = 0;
    state.drive = null;
    state.cards = "pulse";
    setupProbes();
    updateContBtn();
  }

  // 설정을 바꿔도 연속파는 이어서 보낸다 — 고정단·자유단처럼 바꿔 가며 비교하기 좋게
  function reconfigure() {
    const cont = isCont() && state.drive.on;
    configure();
    if (cont) startCont();
  }

  function setTab(n) {
    if (n === state.tab) return;
    state.tab = n;
    configure();
    setF(savedF[n]);
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("is-active", Number(b.dataset.tab) === n));
    document.querySelectorAll(".ctrl-pane").forEach((p) => p.classList.toggle("hidden", Number(p.dataset.pane) !== n));
    syncSegs();
    updateStatus();
    updateCards(null);
  }

  function syncSegs() {
    document.querySelectorAll("#modeSeg button").forEach((b) => b.classList.toggle("is-active", b.dataset.mode === state.mode));
    document.querySelectorAll("#endSeg button").forEach((b) => b.classList.toggle("is-active", b.dataset.end === state.end));
    document.querySelectorAll("#orderSeg button").forEach((b) => b.classList.toggle("is-active", b.dataset.order === state.order));
  }

  function setMode(mode) {
    if (mode === state.mode) return;
    state.mode = mode;
    configure();
    syncSegs();
    updateStatus();
    toast(mode === "T" ? "횡파 — 진동 방향이 진행 방향에 수직" : "종파 — 진동 방향이 진행 방향과 나란");
  }

  function setEnd(end) {
    if (end === state.end) return;
    state.end = end;
    reconfigure();
    syncSegs();
    updateStatus();
  }

  function setOrder(order) {
    if (order === state.order) return;
    state.order = order;
    reconfigure();
    syncSegs();
    updateStatus();
  }

  // 두꺼울수록 두꺼운 줄의 파장이 짧아진다 — 진동수 상한도 함께 낮춘다
  function setThick(v) {
    const thick = Math.round(clamp(Number(v) || 1, 1, 3) * 2) / 2;
    $("thickInput").value = thick;
    $("thickNum").value = thick.toFixed(1);
    if (thick === state.thick) return;
    state.thick = thick;
    if (state.tab === 3) {
      setF(state.f);
      reconfigure();
    }
    updateStatus();
  }

  function sendPulse() {
    if (state.drive) return;
    setupProbes();
    state.drive = { kind: "pulse", t0: state.t };
    state.cards = "pulse";
    if (state.paused) togglePause();
  }

  function startCont() {
    setupProbes();
    state.drive = { kind: "cont", on: true, env: 0, phase: 0, s: 0 };
    state.cards = "cont";
    state.contSince = state.t;
    if (state.paused) togglePause();
    updateContBtn();
  }

  function toggleCont() {
    if (!isCont()) {
      startCont();
      return;
    }
    state.drive.on = !state.drive.on;
    if (state.drive.on) state.contSince = state.t;
    updateContBtn();
  }

  function updateContBtn() {
    const on = isCont() && state.drive.on;
    document.querySelectorAll(".cont-btn").forEach((b) => {
      b.textContent = on ? "연속파 멈춤" : "연속파";
      b.classList.toggle("is-on", on);
    });
    document.querySelectorAll(".pulse-btn").forEach((b) => { b.disabled = isCont(); });
    updateStatus();
  }

  function toggleParts() {
    state.parts = !state.parts;
    $("partsBtn").classList.toggle("is-on", state.parts);
    $("partsBtn").setAttribute("aria-pressed", String(state.parts));
  }

  function setF(v) {
    const max = fMax();
    const f = Math.round(clamp(Number(v) || 1, F_MIN, max) * 10) / 10;
    if (f !== state.f && feed()) state.contSince = state.t;   // 진동수가 바뀌면 새 파동이 자리 잡을 때까지 재지 않는다
    state.f = f;
    savedF[state.tab] = f;
    document.querySelectorAll(".f-input").forEach((el) => { el.max = max; el.value = f; });
    document.querySelectorAll(".f-num").forEach((el) => { el.max = max; el.value = f.toFixed(1); });
  }

  function togglePause() {
    state.paused = !state.paused;
    $("pauseBtn").textContent = state.paused ? "계속" : "일시정지";
    updateStatus();
  }

  function reset() {
    clearChain();
    state.t = 0;
    histTick = 0;
    measured.T = null;
    measured.L = null;
    if (state.paused) togglePause();
  }

  function updateStatus() {
    let tag = MODE_NAME[state.mode];
    if (state.tab === 2) tag += ` · ${END_NAME[state.end]}`;
    if (state.tab === 3) tag += ` · 두께 ${state.thick}배 · 질량 ${+(state.thick ** 2).toFixed(2)}배`;
    if (state.paused) tag += " · 일시정지";
    $("statusTag").textContent = tag;
    const speed = { 1: "실제 빠르기", 0.5: "1/2로 느리게", 0.25: "1/4로 느리게" }[state.slow];
    $("stageHint").textContent = feed() ? `왼쪽 끝: 줄이 계속 이어짐 · ${speed}` : `손잡이를 끌어 흔들 수 있다 · ${speed}`;
    $("partsBtn").classList.toggle("hidden", !feed());
  }

  /* 끌기 — 손잡이를 잡고 흔든다 (마우스·터치 모두). 탭 2·3 연속파일 때는 손잡이가 없다 */
  function onHandle(e) {
    if (!lastG || feed()) return false;
    const r = canvas.getBoundingClientRect();
    const [hx, hy] = beadPos(lastG, 0);
    return Math.hypot(e.clientX - r.left - (hx - 2), e.clientY - r.top - hy) <= 30;
  }

  function dragValue(e) {
    const r = canvas.getBoundingClientRect();
    const g = lastG;
    const v = state.mode === "T"
      ? (g.chainY - (e.clientY - r.top)) / g.ppm
      : (e.clientX - r.left - g.X(0)) / g.ppm;
    const lim = DRAG_MAX[state.mode];
    return clamp(v, -lim, lim);
  }

  function bindDrag() {
    canvas.addEventListener("pointerdown", (e) => {
      if (!onHandle(e)) return;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 포인터가 이미 사라졌으면 잡지 않고 진행 */ }
      setupProbes();
      state.drive = { kind: "drag", y: y[I0] };
      state.cards = "pulse";
      state.dragTarget = dragValue(e);
      updateContBtn();
      if (state.paused) togglePause();
      canvas.style.cursor = "grabbing";
    });
    canvas.addEventListener("pointermove", (e) => {
      if (state.drive && state.drive.kind === "drag") {
        state.dragTarget = dragValue(e);
        return;
      }
      canvas.style.cursor = onHandle(e) ? "grab" : "default";
    });
    const end = () => {
      if (!state.drive || state.drive.kind !== "drag") return;
      state.drive = { kind: "return", y: state.drive.y };
      updateContBtn();
      canvas.style.cursor = "grab";
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
  }

  /* ---------------------------------------------------------
     재생
     --------------------------------------------------------- */
  let lastTs = null;
  let lastReadout = 0;

  function frame(ts) {
    const dtReal = lastTs == null ? 0 : Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    if (!state.paused && dtReal > 0) {
      const steps = Math.round((dtReal * state.slow) / DT);
      for (let k = 0; k < steps; k++) physicsStep(DT);
    }
    const lam = render();
    cardEls.forEach((el, k) => { if (!el.strip.classList.contains("hidden")) drawStrip(el.strip, k); });
    if (ts - lastReadout > 120) {
      updateCards(lam);
      lastReadout = ts;
    }
    requestAnimationFrame(frame);
  }

  function bind() {
    $("pauseBtn").addEventListener("click", togglePause);
    $("resetBtn").addEventListener("click", reset);
    document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => setTab(Number(b.dataset.tab))));
    document.querySelectorAll(".pulse-btn").forEach((b) => b.addEventListener("click", sendPulse));
    document.querySelectorAll(".cont-btn").forEach((b) => b.addEventListener("click", toggleCont));
    $("partsBtn").addEventListener("click", toggleParts);
    document.querySelectorAll("#modeSeg button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
    document.querySelectorAll("#endSeg button").forEach((b) => b.addEventListener("click", () => setEnd(b.dataset.end)));
    document.querySelectorAll("#orderSeg button").forEach((b) => b.addEventListener("click", () => setOrder(b.dataset.order)));
    document.querySelectorAll(".f-input").forEach((el) => el.addEventListener("input", (e) => setF(e.target.value)));
    document.querySelectorAll(".f-num").forEach((el) => el.addEventListener("change", (e) => setF(e.target.value)));
    $("thickInput").addEventListener("input", (e) => setThick(e.target.value));
    $("thickNum").addEventListener("change", (e) => setThick(e.target.value));
    document.querySelectorAll(".num").forEach((el) =>
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); }));
    $("slowSelect").addEventListener("change", (e) => {
      state.slow = Number(e.target.value);
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
        k: [q("k1"), q("k2")], v: [q("v1"), q("v2")], strip: q("strip"), f1: q("f1"), f2: q("f2"),
      };
    });
    setF(state.f);
    setThick(state.thick);
    bind();
    configure();
    syncSegs();
    updateStatus();
    updateCards(null);
    requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
