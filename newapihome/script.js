const COPY_ITEMS = [
  { text: "3D 粒子矩阵", x: 0.16, y: 0.08, size: "1.18vw", alpha: 0.64, driftX: "0.9vw", driftY: "-1.2vh", duration: "11.4s", bright: true },
  { text: "模型御三家", x: 0.54, y: 0.06, size: "0.84vw", alpha: 0.28, driftX: "-0.8vw", driftY: "1vh", duration: "12.2s", dim: true },
  { text: "OpenAI Claude Gemini", x: 0.57, y: 0.13, size: "1vw", alpha: 0.56, driftX: "1vw", driftY: "-1.3vh", duration: "13.2s", bright: true },
  { text: "空间粒子引擎", x: 0.67, y: 0.26, size: "0.72vw", alpha: 0.24, driftX: "-0.4vw", driftY: "0.7vh", duration: "10.2s", dim: true },
  { text: "光锥环绕", x: 0.83, y: 0.33, size: "0.76vw", alpha: 0.24, driftX: "-0.35vw", driftY: "0.6vh", duration: "9.5s", dim: true },
  { text: "御三家共振", x: 0.9, y: 0.77, size: "0.76vw", alpha: 0.22, driftX: "-0.4vw", driftY: "0.7vh", duration: "10.5s", dim: true },
  { text: "核心特效舱", x: 0.58, y: 0.82, size: "1vw", alpha: 0.56, driftX: "-0.7vw", driftY: "1vh", duration: "12.8s" },
  { text: "创作不绕路", x: 0.1, y: 0.31, size: "1.18vw", alpha: 0.52, driftX: "1vw", driftY: "-0.9vh", duration: "12.6s" },
  { text: "低空漂浮", x: 0.02, y: 0.72, size: "0.9vw", alpha: 0.36, driftX: "0.85vw", driftY: "-1.1vh", duration: "11.9s" },
  { text: "智能编排", x: 0.16, y: 0.88, size: "0.84vw", alpha: 0.34, driftX: "0.7vw", driftY: "1vh", duration: "11.6s", dim: true },
  { text: "一站式 AI 工作台", x: 0.22, y: 0.58, size: "0.68vw", alpha: 0.18, driftX: "-0.4vw", driftY: "0.6vh", duration: "11.3s", dim: true },
  { text: "降本增效", x: 0.58, y: 0.88, size: "1.18vw", alpha: 0.68, driftX: "0.7vw", driftY: "-1vh", duration: "12.3s", bright: true },
  { text: "企业级稳定可靠", x: 0.83, y: 0.58, size: "0.72vw", alpha: 0.22, driftX: "0.55vw", driftY: "0.65vh", duration: "10.8s", dim: true },
  { text: "数据安全", x: 0.92, y: 0.44, size: "0.82vw", alpha: 0.3, driftX: "0.5vw", driftY: "0.8vh", duration: "10.6s", dim: true }
];

const MODEL_LOGOS = [
  { name: "OpenAI", label: "OpenAI", phase: 0, tone: "openai" },
  { name: "Claude", label: "Claude", phase: 2.0944, tone: "claude" },
  { name: "Gemini", label: "Gemini", phase: 4.1888, tone: "gemini" }
];

const particleState = {
  canvas: null,
  ctx: null,
  dpr: 1,
  width: 0,
  height: 0,
  particles: [],
  aura: null,
  pointerX: 0,
  pointerY: 0,
  rafId: 0
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createParticle(width, height, depthBoost = Math.random()) {
  const outerRadius = Math.max(width, height) * (0.2 + Math.random() * 0.72);
  return {
    orbitAngle: Math.random() * Math.PI * 2,
    orbitRadius: outerRadius,
    depth: 0.2 + depthBoost * 1.15,
    radius: 0.55 + Math.random() * 1.7,
    speed: 0.0032 + Math.random() * 0.0046,
    swirl: 0.004 + Math.random() * 0.012,
    alpha: 0.16 + Math.random() * 0.54
  };
}

function seedParticles(width, height) {
  const count = width <= 640 ? 140 : width <= 900 ? 220 : 340;
  particleState.particles = Array.from({ length: count }, () => createParticle(width, height));
}

function resizeParticleField() {
  const canvas = particleState.canvas;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;

  particleState.dpr = dpr;
  particleState.width = width;
  particleState.height = height;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  particleState.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  seedParticles(width, height);
}

function renderParticleField(timestamp) {
  const { ctx, width, height, particles } = particleState;
  const centerX = width / 2;
  const centerY = height / 2;
  const parallaxX = (particleState.pointerX - centerX) * 0.014;
  const parallaxY = (particleState.pointerY - centerY) * 0.014;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(1, 1, 1, 0.14)";
  ctx.fillRect(0, 0, width, height);

  const vortexGlow = ctx.createRadialGradient(centerX, centerY, 12, centerX, centerY, Math.min(width, height) * 0.2);
  vortexGlow.addColorStop(0, "rgba(255, 255, 255, 0.11)");
  vortexGlow.addColorStop(0.28, "rgba(255, 255, 255, 0.04)");
  vortexGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = vortexGlow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, Math.min(width, height) * 0.2, 0, Math.PI * 2);
  ctx.fill();

  particles.forEach((particle, index) => {
    const previousRadius = particle.orbitRadius;
    const previousAngle = particle.orbitAngle;

    particle.depth -= particle.speed * 0.18;
    particle.orbitRadius -= 0.82 + particle.speed * 120;
    particle.orbitAngle += particle.swirl * (1.4 - particle.depth * 0.42);

    if (particle.orbitRadius <= 10 || particle.depth <= 0.04) {
      particles[index] = createParticle(width, height, 1);
      return;
    }

    const perspective = 1 / particle.depth;
    const prevX = centerX + Math.cos(previousAngle) * previousRadius * 0.78 / perspective + parallaxX;
    const prevY = centerY + Math.sin(previousAngle) * previousRadius * 0.48 / perspective + parallaxY;
    let drawX = centerX + Math.cos(particle.orbitAngle) * particle.orbitRadius * 0.78 / perspective + parallaxX;
    let drawY = centerY + Math.sin(particle.orbitAngle) * particle.orbitRadius * 0.48 / perspective + parallaxY;
    const size = particle.radius * perspective * 0.92;
    const alpha = clamp(particle.alpha * (1.12 - particle.depth * 0.44), 0.04, 0.94);
    const pointerDx = drawX - particleState.pointerX;
    const pointerDy = drawY - particleState.pointerY;
    const pointerDistance = Math.hypot(pointerDx, pointerDy);

    if (pointerDistance < 180) {
      const repel = (180 - pointerDistance) / 180;
      drawX += (pointerDx / Math.max(pointerDistance, 1)) * repel * 24;
      drawY += (pointerDy / Math.max(pointerDistance, 1)) * repel * 24;
    }

    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.arc(drawX, drawY, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.22})`;
    ctx.lineWidth = Math.max(size * 0.24, 0.35);
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(drawX, drawY);
    ctx.stroke();
  });

  layoutModelRing(timestamp);
  updateAmbientDrift();
  particleState.rafId = window.requestAnimationFrame(renderParticleField);
}

function createCopyNode(item, index, width) {
  const node = document.createElement("div");
  const isMobile = width <= 640;
  const offsetX = Math.sin(index * 1.77) * 1.6;
  const offsetY = Math.cos(index * 1.33) * 1.4;
  const xPercent = clamp(item.x * 100 + offsetX, -12, 108);
  const yPercent = clamp(item.y * 100 + offsetY, -10, 108);

  node.className = "floating-copy-item";
  if (item.dim) {
    node.classList.add("is-dim");
  }
  if (item.bright) {
    node.classList.add("is-bright");
  }

  node.textContent = item.text;
  node.style.left = `${xPercent}%`;
  node.style.top = `${yPercent}%`;
  node.style.setProperty("--size", isMobile ? `${Math.max(12, parseFloat(item.size) * 2.9)}px` : item.size);
  node.style.setProperty("--alpha", String(isMobile ? Math.min(item.alpha + 0.05, 0.84) : item.alpha));
  node.style.setProperty("--drift-x", item.driftX);
  node.style.setProperty("--drift-y", item.driftY);
  node.style.setProperty("--duration", item.duration);
  node.style.setProperty("--delay", `${(index % 9) * 0.58}s`);
  node.style.setProperty("--intro-delay", `${index * 0.055}s`);
  node.style.setProperty("--scale", item.bright ? "1.03" : "1");
  node.style.setProperty("--blur", item.dim ? "0.28px" : "0px");
  node.style.setProperty("--weight", item.bright ? "600" : "500");

  if (Math.abs(xPercent - 50) < 17 && Math.abs(yPercent - 48) < 14) {
    node.style.display = "none";
  }

  return node;
}

function layoutCopyItems() {
  const layer = document.getElementById("floating-copy");
  const width = window.innerWidth;
  const maxItems = width <= 640 ? 10 : width <= 900 ? 12 : COPY_ITEMS.length;

  layer.innerHTML = "";
  COPY_ITEMS.slice(0, maxItems).forEach((item, index) => {
    layer.appendChild(createCopyNode(item, index, width));
  });
}

function createModelBadge(item) {
  const badge = document.createElement("div");
  const badgeAccent = document.createElement("span");
  const badgeName = document.createElement("span");
  const badgeIcon = document.createElement("span");
  const badgeLogo = document.createElement("span");

  badge.className = `model-badge is-${item.tone}`;
  badge.dataset.phase = String(item.phase);
  badgeAccent.className = "model-badge-accent";
  badgeName.className = "model-badge-name";
  badgeIcon.className = "model-badge-icon";
  badgeLogo.className = "model-badge-logo";
  badgeName.textContent = item.name;
  badgeIcon.innerHTML = createModelBadgeIcon(item.tone);
  badgeLogo.textContent = item.label;

  badge.appendChild(badgeAccent);
  badge.appendChild(badgeName);
  badge.appendChild(badgeIcon);
  badge.appendChild(badgeLogo);

  return badge;
}

function createModelBadgeAccent() {
  return "accent";
}

function createModelBadgeIcon(tone) {
  if (tone === "openai") {
    return `
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g stroke="currentColor" stroke-width="2.1" stroke-linecap="round">
          <path d="M16 4.6c2.5 0 4.3 2.3 4 4.8l-.2 1.8 1.7-.7c2.3-.9 5 .3 5.9 2.6.8 2.2-.1 4.8-2.2 5.9l-1.5.8 1.5.8c2.1 1.1 3 3.7 2.2 5.9-.9 2.3-3.6 3.5-5.9 2.6l-1.7-.7.2 1.8c.3 2.5-1.5 4.8-4 4.8-2.4 0-4.3-2.3-4-4.8l.2-1.8-1.7.7c-2.3.9-5-.3-5.9-2.6-.8-2.2.1-4.8 2.2-5.9l1.5-.8-1.5-.8c-2.1-1.1-3-3.7-2.2-5.9.9-2.3 3.6-3.5 5.9-2.6l1.7.7-.2-1.8c-.3-2.5 1.6-4.8 4-4.8Z"/>
        </g>
      </svg>
    `;
  }

  if (tone === "claude") {
    return `
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M7 8.5h4.5v15H7zM13.4 8.5h4.7v15h-4.7zM20 8.5h2.1c1.9 0 3.4 1.5 3.4 3.4v8.2c0 1.9-1.5 3.4-3.4 3.4H20z" fill="currentColor"/>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M16 5.2 18.7 13 26.8 16l-8.1 3-2.7 7.8-2.7-7.8-8.1-3 8.1-3L16 5.2Z" fill="currentColor"/>
      <path d="M24 7.4 25.2 10.8 28.6 12l-3.4 1.2L24 16.6l-1.2-3.4L19.4 12l3.4-1.2L24 7.4Z" fill="currentColor" opacity=".62"/>
    </svg>
  `;
}

function ensureModelRing() {
  const ring = document.getElementById("model-ring");
  if (ring.childElementCount === MODEL_LOGOS.length) {
    return ring;
  }

  ring.innerHTML = "";
  MODEL_LOGOS.forEach((item) => {
    ring.appendChild(createModelBadge(item));
  });
  return ring;
}

function ensureModelSpokes() {
  const layer = document.getElementById("model-spokes");
  if (layer.childElementCount === MODEL_LOGOS.length) {
    return layer;
  }

  layer.innerHTML = "";
  MODEL_LOGOS.forEach(() => {
    const spoke = document.createElement("div");
    spoke.className = "model-spoke";
    layer.appendChild(spoke);
  });
  return layer;
}

function layoutModelRing(timestamp = performance.now()) {
  const ring = ensureModelRing();
  const spokes = Array.from(ensureModelSpokes().children);
  const badges = Array.from(ring.children);
  const width = window.innerWidth;
  const radius = width <= 640 ? 108 : width <= 900 ? 148 : 220;
  const vertical = width <= 640 ? 0.66 : 0.42;
  const tilt = Math.sin(timestamp * 0.00045) * 8;

  badges.forEach((badge, index) => {
    const phase = Number(badge.dataset.phase || 0);
    const angle = timestamp * 0.00058 + phase;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * vertical;
    const depth = (Math.sin(angle) + 1) / 2;
    const scale = 0.82 + depth * 0.34;
    const opacity = 0.34 + depth * 0.58;

    badge.style.opacity = `${opacity}`;
    badge.style.zIndex = `${10 + Math.round(depth * 10)}`;
    badge.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), 0) rotateX(${tilt}deg) scale(${scale})`;
    badge.style.filter = `blur(${(1 - depth) * 0.75}px)`;

    const spoke = spokes[index];
    const length = Math.hypot(x, y);
    const angleDeg = Math.atan2(y, x) * (180 / Math.PI);
    spoke.style.width = `${Math.max(26, length - 52)}px`;
    spoke.style.opacity = `${0.16 + depth * 0.42}`;
    spoke.style.transform = `translate3d(0, 0, 0) rotate(${angleDeg}deg)`;
  });
}

function onPointerMove(event) {
  particleState.pointerX = event.clientX;
  particleState.pointerY = event.clientY;
  updatePointerAura(event.clientX, event.clientY);
  updateHeroPerspective(event.clientX, event.clientY);
}

function updatePointerAura(x, y) {
  if (!particleState.aura) {
    return;
  }

  particleState.aura.style.setProperty("--pointer-x", `${x}px`);
  particleState.aura.style.setProperty("--pointer-y", `${y}px`);
}

function updateHeroPerspective(x, y) {
  const hero = document.querySelector(".hero-mark");
  if (!hero) {
    return;
  }

  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  const deltaX = (x - centerX) / centerX;
  const deltaY = (y - centerY) / centerY;

  hero.style.setProperty("--tilt-x", `${clamp(deltaY * -5.5, -5.5, 5.5)}deg`);
  hero.style.setProperty("--tilt-y", `${clamp(deltaX * 7, -7, 7)}deg`);
}

function updateModelSpokes() {
  layoutModelRing(performance.now());
}

function updateAmbientDrift() {
  const hero = document.querySelector(".hero-mark");
  if (!hero) {
    return;
  }

  const t = performance.now() * 0.00025;
  const driftX = Math.sin(t) * 0.9;
  const driftY = Math.cos(t * 1.2) * 0.75;
  hero.style.marginLeft = `${driftX}px`;
  hero.style.marginTop = `${driftY}px`;
}

function onResize() {
  resizeParticleField();
  layoutCopyItems();
  layoutModelRing(performance.now());
  updatePointerAura(particleState.pointerX, particleState.pointerY);
  updateHeroPerspective(particleState.pointerX, particleState.pointerY);
  updateAmbientDrift();
}

function bootScene() {
  particleState.canvas = document.getElementById("particle-stage");
  particleState.ctx = particleState.canvas.getContext("2d");
  particleState.aura = document.getElementById("pointer-aura");
  particleState.pointerX = window.innerWidth / 2;
  particleState.pointerY = window.innerHeight / 2;

  onResize();
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("resize", onResize);
  particleState.rafId = window.requestAnimationFrame(renderParticleField);
}

bootScene();
