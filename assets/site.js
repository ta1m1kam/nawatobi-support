// Ports JumpAvatarView.swift and WaveformView.swift from the app so the hero shows the real tracking screen.
const SVG_NS = "http://www.w3.org/2000/svg";
const GROUND_Y = 196;
const HAND_Y = 170;
const MIN_JUMP_HEIGHT = 8;
const MAX_JUMP_HEIGHT = 80;
const CYCLE = 0.45;
const WAVE_WINDOW = 3;
const WAVE_SIZE = { width: 320, height: 80 };
const WAVE_RANGE = { min: -1.2, max: 2.0 };
const THRESHOLD = 0.6;

const card = document.querySelector(".stage-card");
if (card) startStage(card);

function startStage(card) {
  const svg = card.querySelector(".stage");
  const wave = card.querySelector(".wave");
  const countLabel = card.querySelector("[data-count]");
  const timeLabel = card.querySelector("[data-time]");
  const doubleUnderLabel = card.querySelector("[data-double-unders]");
  const parts = buildStage(svg);
  const waveParts = buildWave(wave);

  const jumps = [];
  let count = Number(countLabel.textContent);
  let doubleUnders = Number(doubleUnderLabel.textContent);
  let jumpStart = 0;
  let current = nextJump(count);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    drawPose(parts, { phase: 0.52, isJumping: true, jumpHeight: MIN_JUMP_HEIGHT + MAX_JUMP_HEIGHT, ropeTurns: 1 });
    for (let i = 0; i < 7; i++) jumps.push({ time: i * CYCLE, amplitude: 1.1 + (i % 3) * 0.15 });
    drawWave(waveParts, jumps, 6 * CYCLE + 0.2);
    return;
  }

  let isVisible = true;
  new IntersectionObserver(([entry]) => { isVisible = entry.isIntersecting; }).observe(card);

  const elapsedOffset = 36;
  let now = 0;
  let lastFrame = null;
  const frame = (frameMs) => {
    requestAnimationFrame(frame);
    const delta = lastFrame === null ? 0 : (frameMs - lastFrame) / 1000;
    lastFrame = frameMs;
    if (!isVisible) return;
    now += Math.min(delta, 0.1);
    while (now - jumpStart >= CYCLE) {
      jumpStart += CYCLE;
      jumps.push({ time: jumpStart, amplitude: current.amplitude });
      countLabel.textContent = String(++count);
      if (current.ropeTurns === 2) doubleUnderLabel.textContent = String(++doubleUnders);
      current = nextJump(count);
    }
    while (jumps.length && now - jumps[0].time > WAVE_WINDOW + 1) jumps.shift();

    const phase = (now - jumpStart) / CYCLE;
    drawPose(parts, { phase, isJumping: true, jumpHeight: current.jumpHeight, ropeTurns: current.ropeTurns });
    drawWave(waveParts, jumps, now);
    timeLabel.textContent = minutesSeconds(elapsedOffset + now);
  };
  requestAnimationFrame(frame);
}

function nextJump(count) {
  const isDoubleUnder = count % 12 === 11;
  const ratio = isDoubleUnder ? 1 : 0.35 + Math.random() * 0.4;
  return {
    ropeTurns: isDoubleUnder ? 2 : 1,
    jumpHeight: MIN_JUMP_HEIGHT + ratio * MAX_JUMP_HEIGHT,
    amplitude: THRESHOLD + 0.3 + ratio * 0.7,
  };
}

function element(parent, name, attributes) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  parent.appendChild(node);
  return node;
}

function buildStage(svg) {
  const peakLine = element(svg, "line", { x1: 24, x2: 296, stroke: "#5b6474", "stroke-dasharray": "3 5" });
  element(svg, "line", { x1: 0, y1: 200, x2: 350, y2: 200, stroke: "#2f3542", "stroke-width": 2 });
  const shadow = element(svg, "ellipse", { cx: 175, cy: 202, ry: 4, fill: "rgba(0,0,0,0.35)" });
  const rope = element(svg, "path", { fill: "none", stroke: "#c6f432", "stroke-width": 2.5, "stroke-linecap": "round" });
  const lifted = element(svg, "g", {});
  for (const x of [140, 210]) element(lifted, "circle", { cx: x, cy: HAND_Y, r: 5, fill: "#f2f4f7" });
  const body = element(lifted, "g", {});
  element(body, "rect", { x: 151, y: 126, width: 48, height: 70, rx: 24, fill: "#f2f4f7" });
  const eyes = [167, 183].map((x) => element(body, "ellipse", { cx: x, cy: 150, rx: 3, fill: "#0f1115" }));
  for (const x of [147, 197]) element(body, "rect", { x, y: 142, width: 6, height: 12, rx: 3, fill: "#c6f432" });
  element(svg, "line", { x1: 322, y1: GROUND_Y, x2: 322, y2: GROUND_Y - MIN_JUMP_HEIGHT - MAX_JUMP_HEIGHT, stroke: "#2f3542", "stroke-width": 6, "stroke-linecap": "round" });
  const gauge = element(svg, "line", { x1: 322, x2: 322, y1: GROUND_Y, stroke: "#c6f432", "stroke-width": 6, "stroke-linecap": "round" });
  return { peakLine, shadow, rope, lifted, body, eyes, gauge };
}

function drawPose(parts, pose) {
  const lift = pose.isJumping ? pose.jumpHeight * Math.sin(Math.PI * pose.phase) : 0;
  const peakY = GROUND_Y - pose.jumpHeight;
  parts.peakLine.setAttribute("y1", peakY);
  parts.peakLine.setAttribute("y2", peakY);
  parts.gauge.setAttribute("y2", peakY);
  parts.shadow.setAttribute("rx", 22 - lift * 0.12);

  const angle = 2 * Math.PI * pose.phase * pose.ropeTurns;
  const offset = pose.isJumping ? -10 - 52 * Math.cos(angle) : 34;
  const ropeY = HAND_Y - lift;
  parts.rope.setAttribute("d", `M140 ${ropeY} Q175 ${ropeY + 2 * offset} 210 ${ropeY}`);
  parts.rope.setAttribute("stroke-opacity", pose.isJumping && Math.sin(angle) > 0 ? 0.45 : 1);

  const contact = pose.isJumping ? Math.max(0, 1 - Math.min(pose.phase, 1 - pose.phase) / 0.12) : 0;
  const airborne = pose.isJumping ? Math.sin(Math.PI * pose.phase) : 0;
  const scaleX = 1 + 0.14 * contact - 0.04 * airborne;
  const scaleY = 1 - 0.14 * contact + 0.06 * airborne;
  parts.lifted.setAttribute("transform", `translate(0 ${-lift})`);
  parts.body.setAttribute("transform", `translate(175 ${GROUND_Y}) scale(${scaleX} ${scaleY}) translate(-175 ${-GROUND_Y})`);
  const eyeHeight = contact > 0.5 ? 2.4 : 7;
  for (const eye of parts.eyes) eye.setAttribute("ry", eyeHeight / 2);
}

function buildWave(svg) {
  const y = waveY(THRESHOLD);
  element(svg, "line", { x1: 0, x2: WAVE_SIZE.width, y1: y, y2: y, stroke: "#5b6474", "stroke-dasharray": "4 4" });
  const line = element(svg, "polyline", { fill: "none", stroke: "#c6f432", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" });
  const dots = element(svg, "g", { fill: "#f2f4f7" });
  return { line, dots };
}

function waveY(value) {
  const clamped = Math.min(WAVE_RANGE.max, Math.max(WAVE_RANGE.min, value));
  return WAVE_SIZE.height * (WAVE_RANGE.max - clamped) / (WAVE_RANGE.max - WAVE_RANGE.min);
}

function acceleration(time, jumps) {
  let value = 0;
  for (const jump of jumps) {
    const distance = time - jump.time;
    value += jump.amplitude * Math.exp(-((distance / 0.035) ** 2));
    if (distance > 0 && distance < CYCLE) value -= 0.35 * Math.sin(Math.PI * distance / CYCLE);
  }
  return value;
}

function drawWave(parts, jumps, now) {
  const x = (time) => WAVE_SIZE.width - ((now - time) / WAVE_WINDOW) * WAVE_SIZE.width;
  const points = [];
  for (let time = now - WAVE_WINDOW; time <= now; time += 0.01) {
    points.push(`${x(time).toFixed(1)},${waveY(acceleration(time, jumps)).toFixed(1)}`);
  }
  parts.line.setAttribute("points", points.join(" "));

  const visible = jumps.filter((jump) => now - jump.time <= WAVE_WINDOW);
  while (parts.dots.childElementCount < visible.length) element(parts.dots, "circle", { r: 3 });
  [...parts.dots.children].forEach((dot, index) => {
    const jump = visible[index];
    dot.style.display = jump ? "" : "none";
    if (!jump) return;
    dot.setAttribute("cx", x(jump.time));
    dot.setAttribute("cy", waveY(jump.amplitude) - 6);
  });
}

function minutesSeconds(seconds) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
