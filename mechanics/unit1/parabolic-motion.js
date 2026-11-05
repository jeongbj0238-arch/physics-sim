/* ============================================================
   이상적 포물선 운동 시뮬레이터
   공기저항 없는 닫힌형 공식 사용. 캔버스 유틸은 shared/sim-utils.js 공유.
   ============================================================ */

(() => {
  "use strict";

  const el = (id) => document.getElementById(id);

  const simCanvas = el("simCanvas");
  const heightGraphCanvas = el("heightGraph");
  const xGraphCanvas = el("xGraph");
  const statusTag = el("statusTag");
  const recDot = el("recDot");

  const angleInput = el("angleInput");
  const speedInput = el("speedInput");
  const heightInput = el("heightInput");
  const gravitySelect = el("gravitySelect");
  const gravityCustom = el("gravityCustom");
  const gravityCustomValue = el("gravityCustomValue");
  const timeScaleSelect = el("timeScaleSelect");
  const showVectors = el("showVectors");
  const keepTrails = el("keepTrails");

  const angleValue = el("angleValue");
  const speedValue = el("speedValue");
  const heightValue = el("heightValue");

  const launchBtn = el("launchBtn");
  const pauseBtn = el("pauseBtn");
  const resetBtn = el("resetBtn");

  const valT = el("valT");
  const valX = el("valX");
  const valY = el("valY");
  const valV = el("valV");
  const valMaxH = el("valMaxH");
  const valResult = el("valResult");

  const settingsToggle = el("settingsToggle");
  const settingsOverlay = el("settingsOverlay");
  const settingsBackdrop = el("settingsBackdrop");
  const settingsClose = el("settingsClose");

  const trajPointInfo = el("trajPointInfo");
  const heightPointInfo = el("heightPointInfo");
  const xPointInfo = el("xPointInfo");

  const COLOR_ACCENT = "#0075de";
  const COLOR_TRAIL = "rgba(0, 117, 222, 0.28)";
  const COLOR_VX = "#3daeff";
  const COLOR_VY = "#ff5530";
  const COLOR_PREVIEW = "#8cc1f0";

  // ---------- Point-info (click-to-inspect) state ----------

  let trajToPx = null;
  const graphToPx = { y: null, x: null };
  const pinned = { traj: null, y: null, x: null };

  function trajValuesAt(traj, t) {
    const y = Math.max(0, traj.h0 + traj.vy0 * t - 0.5 * traj.g * t * t);
    const vy = traj.vy0 - traj.g * t;
    return { x: traj.vx0 * t, y, vx: traj.vx0, vy, ax: 0, ay: -traj.g };
  }

  function updateTrajPointInfo(t) {
    if (!sim.traj || !trajToPx) return;
    const v = trajValuesAt(sim.traj, t);
    const { px, py } = trajToPx(v.x, v.y);
    trajPointInfo.innerHTML =
      `t = ${t.toFixed(2)}<small>s</small><br>` +
      `높이 y = ${v.y.toFixed(2)}<small>m</small><br>` +
      `수평속도 vx = ${v.vx.toFixed(2)}<small>m/s</small><br>` +
      `수직속도 vy = ${v.vy.toFixed(2)}<small>m/s</small><br>` +
      `가속도 = (${v.ax.toFixed(2)}, ${v.ay.toFixed(2)})<small>m/s²</small>`;
    trajPointInfo.style.left = `${px}px`;
    trajPointInfo.style.top = `${py}px`;
    trajPointInfo.classList.remove("hidden");
  }

  function updateGraphPointInfo(key, t, infoEl) {
    if (!sim.traj || !graphToPx[key]) return;
    const v = trajValuesAt(sim.traj, t);
    const value = key === "y" ? v.y : v.x;
    const { px, py } = graphToPx[key](t, value);
    infoEl.innerHTML =
      `t = ${t.toFixed(2)}<small>s</small><br>` +
      `${key === "y" ? "높이 y" : "수평거리 x"} = ${value.toFixed(2)}<small>m</small>`;
    infoEl.style.left = `${px}px`;
    infoEl.style.top = `${py}px`;
    infoEl.classList.remove("hidden");
  }

  function clearPointInfo() {
    pinned.traj = null;
    pinned.y = null;
    pinned.x = null;
    trajPointInfo.classList.add("hidden");
    heightPointInfo.classList.add("hidden");
    xPointInfo.classList.add("hidden");
  }

  // ---------- Physics ----------

  function computeTrajectory(v0, angleDeg, h0, g, sampleCount = 240) {
    const angle = SimUtils.toRad(angleDeg);
    const vx0 = v0 * Math.cos(angle);
    const vy0 = v0 * Math.sin(angle);

    let tFlight = (vy0 + Math.sqrt(vy0 * vy0 + 2 * g * h0)) / g;
    if (!isFinite(tFlight) || tFlight <= 0) tFlight = 0.001;

    const maxHeight = h0 + (vy0 > 0 ? (vy0 * vy0) / (2 * g) : 0);
    const range = vx0 * tFlight;

    const samples = [];
    for (let i = 0; i <= sampleCount; i++) {
      const t = (tFlight * i) / sampleCount;
      const x = vx0 * t;
      const y = Math.max(0, h0 + vy0 * t - 0.5 * g * t * t);
      samples.push({ t, x, y });
    }

    return { vx0, vy0, tFlight, maxHeight, range, samples, h0, g };
  }

  function stateAt(traj, t) {
    const tt = Math.min(Math.max(t, 0), traj.tFlight);
    const x = traj.vx0 * tt;
    const y = Math.max(0, traj.h0 + traj.vy0 * tt - 0.5 * traj.g * tt * tt);
    const vy = traj.vy0 - traj.g * tt;
    return { t: tt, x, y, vx: traj.vx0, vy };
  }

  function peakPoint(traj) {
    const t = traj.vy0 > 0 ? traj.vy0 / traj.g : 0;
    return { t, x: traj.vx0 * t, y: traj.maxHeight };
  }

  // ---------- App state ----------

  const sim = {
    running: false,
    paused: false,
    landed: false,
    simTime: 0,
    lastFrame: null,
    timeScale: 1,
    traj: null,
    previewTraj: null,
    trails: [],
  };

  function readInputs() {
    const v0 = Number(speedInput.value);
    const angleDeg = Number(angleInput.value);
    const h0 = Number(heightInput.value);
    const g =
      gravitySelect.value === "custom"
        ? Number(gravityCustom.value)
        : Number(gravitySelect.value);
    return { v0, angleDeg, h0, g };
  }

  function refreshPreview() {
    const { v0, angleDeg, h0, g } = readInputs();
    sim.previewTraj = computeTrajectory(v0, angleDeg, h0, g);
    render();
  }

  function activeTraj() {
    return sim.traj || sim.previewTraj;
  }

  function worldBounds(traj) {
    const w = Math.max(traj.range, traj.vx0 * traj.tFlight, 6) * 1.18 + 1;
    const h = Math.max(traj.maxHeight, traj.h0, 4) * 1.28 + 1;
    return { w, h };
  }

  /**
   * SimUtils.drawWorldGrid과 달리 x/y축을 독립적으로 스케일링한다.
   * 궤적 캔버스가 옆 패널과 나란히 세로로 길어지면서, 가로:세로 세계 비율(보통 3:1 이상)을
   * 그대로 유지하면 캔버스 아래쪽 대부분이 빈 공간으로 남기 때문.
   */
  function drawSimGrid(ctx, w, h, worldW, worldH) {
    const padL = 46, padR = 18, padT = 18, padB = 34;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const scaleX = plotW / worldW;
    const scaleY = plotH / worldH;

    const originX = padL;
    const originY = padT + plotH;

    const toPx = (x, y) => ({
      px: originX + x * scaleX,
      py: originY - y * scaleY,
    });

    const stepX = SimUtils.niceStep(worldW);
    const stepY = SimUtils.niceStep(worldH);

    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.font = "11px JetBrains Mono, monospace";
    ctx.fillStyle = "#8e8e93";

    for (let gx = 0; gx <= worldW; gx += stepX) {
      const { px } = toPx(gx, 0);
      ctx.beginPath();
      ctx.moveTo(px, padT);
      ctx.lineTo(px, originY);
      ctx.stroke();
      ctx.fillText(String(Math.round(gx)), px + 2, originY + 14);
    }
    for (let gy = 0; gy <= worldH; gy += stepY) {
      const { py } = toPx(0, gy);
      ctx.beginPath();
      ctx.moveTo(padL, py);
      ctx.lineTo(w - padR, py);
      ctx.stroke();
      ctx.fillText(String(Math.round(gy)), 4, py - 3);
    }

    ctx.strokeStyle = "#a8aab2";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padL, originY);
    ctx.lineTo(w - padR, originY);
    ctx.stroke();

    return { toPx, originY, scaleX, scaleY };
  }

  // ---------- Sim canvas rendering ----------

  function drawSim() {
    const { w, h, ctx } = SimUtils.fitCanvas(simCanvas);
    ctx.clearRect(0, 0, w, h);

    const traj = activeTraj();
    if (!traj) return;

    const bounds = worldBounds(traj);
    const { toPx, originY, scaleX, scaleY } = drawSimGrid(ctx, w, h, bounds.w, bounds.h);
    trajToPx = toPx;

    sim.trails.forEach((t) => SimUtils.drawPath(ctx, t.samples, toPx, COLOR_TRAIL, 2, false));

    const mount = toPx(0, traj.h0);
    ctx.fillStyle = "#a8aab2";
    ctx.beginPath();
    ctx.moveTo(mount.px - 10, originY);
    ctx.lineTo(mount.px + 10, originY);
    ctx.lineTo(mount.px, mount.py);
    ctx.closePath();
    ctx.fill();

    if (!sim.running && !sim.landed) {
      SimUtils.drawPath(ctx, traj.samples, toPx, COLOR_PREVIEW, 2, true);
      const p0 = toPx(0, traj.h0);

      const angleDeg = Number(angleInput.value);
      const angleRad = SimUtils.toRad(angleDeg);
      // 캔버스 x/y축이 서로 다른 배율로 그려지므로(drawSimGrid), 호의 각도는 실제 물리 각도가
      // 아니라 "화면에 그려진 점선의 초기 방향"에 맞춰야 시각적으로 자연스럽게 이어진다.
      // 숫자 라벨은 그대로 실제 각도(angleDeg)를 보여준다.
      const visualAngle = Math.atan2(Math.sin(angleRad) * scaleY, Math.cos(angleRad) * scaleX);
      const R = 42;
      ctx.save();
      ctx.strokeStyle = "#c3cad6";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(p0.px, p0.py);
      ctx.lineTo(p0.px + R + 12, p0.py);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = COLOR_ACCENT;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p0.px, p0.py, R, -visualAngle, 0, false);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = COLOR_ACCENT;
      ctx.font = "600 12px JetBrains Mono, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const labelR = R + 16;
      const halfAngle = visualAngle / 2;
      ctx.fillText(
        `${angleDeg}°`,
        p0.px + labelR * Math.cos(halfAngle),
        p0.py - labelR * Math.sin(halfAngle)
      );
      ctx.restore();

      ctx.fillStyle = COLOR_ACCENT;
      ctx.beginPath();
      ctx.arc(p0.px, p0.py, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const cutoff = sim.landed ? traj.tFlight : sim.simTime;
      const visible = traj.samples.filter((s) => s.t <= cutoff);
      SimUtils.drawPath(ctx, visible, toPx, COLOR_ACCENT, 2.5, false);

      const cur = stateAt(traj, sim.simTime);
      const p = toPx(cur.x, cur.y);

      if (showVectors.checked && !sim.landed) {
        const vscale = 2.6;
        const vxEnd = { px: p.px + cur.vx * vscale, py: p.py };
        const vyEnd = { px: p.px, py: p.py - cur.vy * vscale };

        ctx.lineWidth = 2;
        ctx.strokeStyle = COLOR_VX;
        SimUtils.arrow(ctx, p.px, p.py, vxEnd.px, vxEnd.py);
        ctx.strokeStyle = COLOR_VY;
        SimUtils.arrow(ctx, p.px, p.py, vyEnd.px, vyEnd.py);

        ctx.save();
        ctx.font = "600 11px JetBrains Mono, monospace";
        ctx.textBaseline = "middle";

        ctx.fillStyle = COLOR_VX;
        ctx.textAlign = cur.vx >= 0 ? "left" : "right";
        ctx.fillText(`vx ${cur.vx.toFixed(2)} m/s`, vxEnd.px + (cur.vx >= 0 ? 5 : -5), vxEnd.py - 10);

        ctx.fillStyle = COLOR_VY;
        ctx.textAlign = "left";
        ctx.fillText(`vy ${cur.vy.toFixed(2)} m/s`, vyEnd.px + 8, vyEnd.py);
        ctx.restore();
      }

      ctx.save();
      ctx.shadowColor = COLOR_ACCENT;
      ctx.shadowBlur = sim.landed ? 0 : 8;
      ctx.fillStyle = COLOR_ACCENT;
      ctx.beginPath();
      ctx.arc(p.px, p.py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (pinned.traj != null) {
        const cutoff = sim.landed ? traj.tFlight : sim.simTime;
        if (pinned.traj <= cutoff + 1e-6) {
          updateTrajPointInfo(pinned.traj);
        } else {
          pinned.traj = null;
          trajPointInfo.classList.add("hidden");
        }
      }

      if (sim.landed) {
        const peak = peakPoint(traj);
        const pk = toPx(peak.x, peak.y);
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = COLOR_ACCENT;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(pk.px, pk.py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = COLOR_ACCENT;
        ctx.font = "600 11px JetBrains Mono, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`최고점 ${peak.y.toFixed(2)}m`, pk.px, pk.py - 10);
        ctx.restore();
      }
    }
  }

  // ---------- Graphs ----------

  function drawGraph(canvas, key, color, infoEl) {
    const { w, h, ctx } = SimUtils.fitCanvas(canvas);
    ctx.clearRect(0, 0, w, h);

    const traj = activeTraj();
    if (!traj) return;

    const padL = 34, padR = 10, padT = 10, padB = 20;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const xMax = traj.tFlight;
    const yMax = key === "y" ? Math.max(traj.maxHeight, traj.h0, 1) * 1.15 : Math.max(traj.range, 1) * 1.1;

    const toPx = (t, v) => ({
      px: padL + (t / xMax) * plotW,
      py: padT + plotH - (v / yMax) * plotH,
    });
    graphToPx[key] = toPx;

    const stepX = SimUtils.niceStep(xMax, 5);
    const stepY = SimUtils.niceStep(yMax, 5);

    ctx.strokeStyle = "#eef0f3";
    ctx.lineWidth = 1;
    ctx.font = "10px JetBrains Mono, monospace";
    ctx.fillStyle = "#8e8e93";

    for (let gx = 0; gx <= xMax + 1e-9; gx += stepX) {
      const { px } = toPx(gx, 0);
      ctx.beginPath();
      ctx.moveTo(px, padT);
      ctx.lineTo(px, padT + plotH);
      ctx.stroke();
      ctx.fillText(gx % 1 === 0 ? String(gx) : gx.toFixed(1), px + 2, padT + plotH + 12);
    }
    for (let gy = 0; gy <= yMax + 1e-9; gy += stepY) {
      const { py } = toPx(0, gy);
      ctx.beginPath();
      ctx.moveTo(padL, py);
      ctx.lineTo(padL + plotW, py);
      ctx.stroke();
      ctx.fillText(String(Math.round(gy)), 2, py - 3);
    }

    ctx.strokeStyle = "#a8aab2";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    const cutoff = sim.landed ? traj.tFlight : sim.running ? sim.simTime : xMax;
    const dashed = !sim.running && !sim.landed;
    const pts = traj.samples.filter((s) => s.t <= cutoff);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (dashed) ctx.setLineDash([4, 4]);
    ctx.beginPath();
    pts.forEach((s, i) => {
      const { px, py } = toPx(s.t, key === "y" ? s.y : s.x);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();

    if ((sim.running || sim.landed) && pts.length) {
      const last = pts[pts.length - 1];
      const { px, py } = toPx(last.t, key === "y" ? last.y : last.x);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (infoEl && pinned[key] != null) {
      if (pinned[key] <= cutoff + 1e-6) {
        updateGraphPointInfo(key, pinned[key], infoEl);
      } else {
        pinned[key] = null;
        infoEl.classList.add("hidden");
      }
    }

    if (key === "y" && sim.landed) {
      const peak = peakPoint(traj);
      const { px, py } = toPx(peak.t, peak.y);
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = "600 10px JetBrains Mono, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`최고점 ${peak.y.toFixed(2)}m`, px, py - 8);
      ctx.restore();
    }
  }

  function render() {
    drawSim();
    drawGraph(heightGraphCanvas, "y", COLOR_ACCENT, heightPointInfo);
    drawGraph(xGraphCanvas, "x", COLOR_VX, xPointInfo);
    updateRecorder();
  }

  // ---------- Recorder ----------

  function updateRecorder() {
    const traj = activeTraj();
    if (!traj) return;

    if (sim.running || sim.landed) {
      const cur = stateAt(traj, sim.simTime);
      valT.innerHTML = `${cur.t.toFixed(2)}<small>s</small>`;
      valX.innerHTML = `${cur.x.toFixed(2)}<small>m</small>`;
      valY.innerHTML = `${cur.y.toFixed(2)}<small>m</small>`;
      valV.innerHTML = `${cur.vx.toFixed(2)} / ${cur.vy.toFixed(2)}<small>m/s</small>`;
      valMaxH.innerHTML = `${traj.maxHeight.toFixed(2)}<small>m</small>`;
    } else {
      valT.innerHTML = `0.00<small>s</small>`;
      valX.innerHTML = `0.00<small>m</small>`;
      valY.innerHTML = `${traj.h0.toFixed(2)}<small>m</small>`;
      valV.innerHTML = `${traj.vx0.toFixed(2)} / ${traj.vy0.toFixed(2)}<small>m/s</small>`;
      valMaxH.innerHTML = `${traj.maxHeight.toFixed(2)}<small>m</small> (예상)`;
    }

    valResult.textContent = sim.landed ? `${traj.range.toFixed(2)}m / ${traj.tFlight.toFixed(2)}s` : "–";

    recDot.classList.toggle("live", sim.running);
    statusTag.textContent = sim.landed ? "착지 완료" : sim.running ? "비행 중" : "발사 대기 중";
    statusTag.classList.toggle("flying", sim.running);
    statusTag.classList.toggle("landed", sim.landed);
  }

  // ---------- Animation loop ----------

  function frame(ts) {
    if (!sim.running) return;
    if (sim.lastFrame == null) sim.lastFrame = ts;
    const dt = (ts - sim.lastFrame) / 1000;
    sim.lastFrame = ts;

    if (!sim.paused) {
      sim.simTime += dt * sim.timeScale;
      if (sim.simTime >= sim.traj.tFlight) {
        sim.simTime = sim.traj.tFlight;
        sim.running = false;
        sim.landed = true;
        pauseBtn.disabled = true;
        launchBtn.disabled = false;
      }
    }

    render();
    if (sim.running) requestAnimationFrame(frame);
  }

  // ---------- Controls ----------

  function launch() {
    const { v0, angleDeg, h0, g } = readInputs();
    const traj = computeTrajectory(v0, angleDeg, h0, g);

    clearPointInfo();

    if (keepTrails.checked && sim.traj) {
      sim.trails.push(sim.traj);
    } else if (!keepTrails.checked) {
      sim.trails = [];
    }

    sim.traj = traj;
    sim.previewTraj = null;
    sim.simTime = 0;
    sim.lastFrame = null;
    sim.running = true;
    sim.paused = false;
    sim.landed = false;
    sim.timeScale = Number(timeScaleSelect.value);

    launchBtn.disabled = true;
    pauseBtn.disabled = false;
    pauseBtn.textContent = "일시정지";

    requestAnimationFrame(frame);
  }

  function togglePause() {
    if (!sim.running) return;
    sim.paused = !sim.paused;
    pauseBtn.textContent = sim.paused ? "재생" : "일시정지";
    if (!sim.paused) {
      sim.lastFrame = null;
      requestAnimationFrame(frame);
    }
  }

  function reset() {
    sim.running = false;
    sim.paused = false;
    sim.landed = false;
    sim.simTime = 0;
    sim.traj = null;
    sim.trails = [];
    launchBtn.disabled = false;
    pauseBtn.disabled = true;
    pauseBtn.textContent = "일시정지";
    clearPointInfo();
    refreshPreview();
  }

  // ---------- Click-to-inspect ----------

  simCanvas.addEventListener("click", (e) => {
    if (!sim.traj || !trajToPx) return;
    const rect = simCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cutoff = sim.landed ? sim.traj.tFlight : sim.simTime;

    let best = null, bestD = Infinity;
    for (const s of sim.traj.samples) {
      if (s.t > cutoff + 1e-9) break;
      const { px, py } = trajToPx(s.x, s.y);
      const d = Math.hypot(px - mx, py - my);
      if (d < bestD) { bestD = d; best = s; }
    }

    if (best && bestD <= 18) {
      pinned.traj = best.t;
      updateTrajPointInfo(best.t);
    } else {
      pinned.traj = null;
      trajPointInfo.classList.add("hidden");
    }
  });

  function attachGraphClick(canvas, key, infoEl) {
    canvas.addEventListener("click", (e) => {
      if (!sim.traj || !graphToPx[key]) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cutoff = sim.landed ? sim.traj.tFlight : sim.simTime;

      let best = null, bestD = Infinity;
      for (const s of sim.traj.samples) {
        if (s.t > cutoff + 1e-9) break;
        const value = key === "y" ? s.y : s.x;
        const { px, py } = graphToPx[key](s.t, value);
        const d = Math.hypot(px - mx, py - my);
        if (d < bestD) { bestD = d; best = s; }
      }

      if (best && bestD <= 16) {
        pinned[key] = best.t;
        updateGraphPointInfo(key, best.t, infoEl);
      } else {
        pinned[key] = null;
        infoEl.classList.add("hidden");
      }
    });
  }

  attachGraphClick(heightGraphCanvas, "y", heightPointInfo);
  attachGraphClick(xGraphCanvas, "x", xPointInfo);

  // ---------- Settings overlay ----------

  function openSettings() { settingsOverlay.classList.remove("hidden"); }
  function closeSettings() { settingsOverlay.classList.add("hidden"); }

  settingsToggle.addEventListener("click", openSettings);
  settingsClose.addEventListener("click", closeSettings);
  settingsBackdrop.addEventListener("click", closeSettings);

  // ---------- Wiring ----------

  function syncLabels() {
    angleValue.textContent = `${angleInput.value}°`;
    speedValue.textContent = `${speedInput.value} m/s`;
    heightValue.textContent = `${heightInput.value} m`;
  }

  [angleInput, speedInput, heightInput].forEach((input) => {
    input.addEventListener("input", () => {
      syncLabels();
      if (!sim.running) refreshPreview();
    });
  });

  gravitySelect.addEventListener("change", () => {
    const isCustom = gravitySelect.value === "custom";
    gravityCustom.classList.toggle("hidden", !isCustom);
    gravityCustomValue.style.display = isCustom ? "block" : "none";
    if (!sim.running) refreshPreview();
  });

  gravityCustom.addEventListener("input", () => {
    gravityCustomValue.textContent = `${Number(gravityCustom.value).toFixed(1)} m/s²`;
    if (!sim.running) refreshPreview();
  });

  timeScaleSelect.addEventListener("change", () => {
    sim.timeScale = Number(timeScaleSelect.value);
  });

  keepTrails.addEventListener("change", () => {
    if (!keepTrails.checked) sim.trails = [];
    render();
  });

  showVectors.addEventListener("change", render);

  launchBtn.addEventListener("click", launch);
  pauseBtn.addEventListener("click", togglePause);
  resetBtn.addEventListener("click", reset);

  window.addEventListener("resize", () => render());

  // ---------- Init ----------

  syncLabels();
  refreshPreview();
})();
