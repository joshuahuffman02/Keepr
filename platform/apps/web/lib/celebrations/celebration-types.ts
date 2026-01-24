"use client";

export type CelebrationType =
  | "confetti" // Booking confirmed
  | "stars" // First review
  | "fireworks" // Loyalty milestone
  | "hearts" // Charity donation
  | "sparkles"; // General success

export interface CelebrationConfig {
  type: CelebrationType;
  duration: number; // ms
  particles: number;
  colors: string[];
}

export const celebrationConfigs: Record<CelebrationType, CelebrationConfig> = {
  confetti: {
    type: "confetti",
    duration: 3000,
    particles: 140,
    colors: ["#10b981", "#22d3ee", "#f59e0b", "#f97316", "#6366f1"],
  },
  stars: {
    type: "stars",
    duration: 2500,
    particles: 25,
    colors: ["#fbbf24", "#fcd34d", "#fef3c7", "#f59e0b"],
  },
  fireworks: {
    type: "fireworks",
    duration: 4000,
    particles: 200,
    colors: ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"],
  },
  hearts: {
    type: "hearts",
    duration: 3000,
    particles: 15,
    colors: ["#f43f5e", "#ec4899", "#fb7185", "#fda4af"],
  },
  sparkles: {
    type: "sparkles",
    duration: 2000,
    particles: 30,
    colors: ["#fbbf24", "#f59e0b", "#ffffff"],
  },
};

// Launch a specific celebration animation
export function launchCelebration(type: CelebrationType) {
  if (typeof window === "undefined") return;

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  const config = celebrationConfigs[type];

  switch (type) {
    case "confetti":
      launchConfettiEffect(config);
      break;
    case "stars":
      launchStarsEffect(config);
      break;
    case "fireworks":
      launchFireworksEffect(config);
      break;
    case "hearts":
      launchHeartsEffect(config);
      break;
    case "sparkles":
      launchSparklesEffect(config);
      break;
  }
}

// Confetti burst from center
function launchConfettiEffect(config: CelebrationConfig) {
  const canvas = createCanvas();
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const centerX = canvas.width / 2;
  const centerY = canvas.height * 0.3;

  const particles = Array.from({ length: config.particles }).map(() => {
    const angle = (Math.random() - 0.5) * Math.PI;
    const speed = 8 + Math.random() * 6;
    return {
      x: centerX,
      y: centerY,
      r: 3 + Math.random() * 3,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      color: config.colors[Math.floor(Math.random() * config.colors.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.2,
    };
  });

  animateParticles(canvas, ctx, particles, config.duration, (p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.2;
    p.rot += p.vr;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
    ctx.restore();
  });
}

// Stars burst outward
function launchStarsEffect(config: CelebrationConfig) {
  const canvas = createCanvas();
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  const particles = Array.from({ length: config.particles }).map(() => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    return {
      x: centerX,
      y: centerY,
      size: 10 + Math.random() * 15,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: config.colors[Math.floor(Math.random() * config.colors.length)],
      opacity: 1,
      rot: Math.random() * Math.PI,
    };
  });

  animateParticles(canvas, ctx, particles, config.duration, (p, elapsed) => {
    p.x += p.vx;
    p.y += p.vy;
    p.rot += 0.02;
    p.opacity = Math.max(0, 1 - elapsed / config.duration);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = p.color;
    drawStar(ctx, 0, 0, 5, p.size, p.size / 2);
    ctx.restore();
  });
}

// Fireworks with multiple bursts
function launchFireworksEffect(config: CelebrationConfig) {
  const canvas = createCanvas();
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  // Three bursts at different positions
  const bursts = [
    { x: canvas.width * 0.2, y: canvas.height * 0.3, delay: 0 },
    { x: canvas.width * 0.5, y: canvas.height * 0.25, delay: 500 },
    { x: canvas.width * 0.8, y: canvas.height * 0.35, delay: 1000 },
  ];

  const allParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    opacity: number;
    startTime: number;
  }> = [];

  bursts.forEach((burst) => {
    const particlesPerBurst = Math.floor(config.particles / 3);
    for (let i = 0; i < particlesPerBurst; i++) {
      const angle = (i / particlesPerBurst) * Math.PI * 2;
      const speed = 3 + Math.random() * 3;
      allParticles.push({
        x: burst.x,
        y: burst.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: config.colors[Math.floor(Math.random() * config.colors.length)],
        size: 3 + Math.random() * 2,
        opacity: 1,
        startTime: burst.delay,
      });
    }
  });

  const start = performance.now();

  const frame = () => {
    const elapsed = performance.now() - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    allParticles.forEach((p) => {
      if (elapsed < p.startTime) return;

      const particleElapsed = elapsed - p.startTime;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.opacity = Math.max(0, 1 - particleElapsed / (config.duration - p.startTime));

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    if (elapsed < config.duration) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  };

  requestAnimationFrame(frame);
}

// Hearts floating up
function launchHeartsEffect(config: CelebrationConfig) {
  const canvas = createCanvas();
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const particles = Array.from({ length: config.particles }).map(() => ({
    x: canvas.width * 0.3 + Math.random() * canvas.width * 0.4,
    y: canvas.height,
    size: 15 + Math.random() * 20,
    vy: -(2 + Math.random() * 3),
    vx: (Math.random() - 0.5) * 2,
    color: config.colors[Math.floor(Math.random() * config.colors.length)],
    opacity: 1,
    wobble: Math.random() * Math.PI * 2,
  }));

  animateParticles(canvas, ctx, particles, config.duration, (p, elapsed) => {
    p.y += p.vy;
    p.x += Math.sin(p.wobble + elapsed * 0.003) * 0.5;
    p.opacity = Math.max(0, 1 - elapsed / config.duration);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = p.color;
    drawHeart(ctx, 0, 0, p.size);
    ctx.restore();
  });
}

// Sparkles twinkling
function launchSparklesEffect(config: CelebrationConfig) {
  const canvas = createCanvas();
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const particles = Array.from({ length: config.particles }).map(() => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height * 0.6,
    size: 5 + Math.random() * 10,
    color: config.colors[Math.floor(Math.random() * config.colors.length)],
    phase: Math.random() * Math.PI * 2,
    frequency: 0.01 + Math.random() * 0.02,
  }));

  animateParticles(canvas, ctx, particles, config.duration, (p, elapsed) => {
    const twinkle = Math.sin(p.phase + elapsed * p.frequency) * 0.5 + 0.5;
    const fade = Math.max(0, 1 - elapsed / config.duration);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = twinkle * fade;
    ctx.fillStyle = p.color;
    drawStar(ctx, 0, 0, 4, p.size, p.size / 3);
    ctx.restore();
  });
}

// Helper functions
function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.pointerEvents = "none";
  canvas.style.inset = "0";
  canvas.style.zIndex = "9999";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  return canvas;
}

function animateParticles<T>(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  particles: T[],
  duration: number,
  updateAndDraw: (particle: T, elapsed: number) => void,
) {
  const start = performance.now();

  const frame = () => {
    const elapsed = performance.now() - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p) => updateAndDraw(p, elapsed));

    if (elapsed < duration) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  };

  requestAnimationFrame(frame);
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number,
) {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);

  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
    rot += step;
  }

  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const width = size;
  const height = size;

  ctx.beginPath();
  ctx.moveTo(x, y + height / 4);

  // Left curve
  ctx.bezierCurveTo(x, y, x - width / 2, y, x - width / 2, y + height / 4);

  // Left bottom
  ctx.bezierCurveTo(x - width / 2, y + height / 2, x, y + height * 0.75, x, y + height);

  // Right bottom
  ctx.bezierCurveTo(
    x,
    y + height * 0.75,
    x + width / 2,
    y + height / 2,
    x + width / 2,
    y + height / 4,
  );

  // Right curve
  ctx.bezierCurveTo(x + width / 2, y, x, y, x, y + height / 4);

  ctx.fill();
}
