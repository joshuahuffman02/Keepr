"use client";

// Tiny, dependency-free confetti helper for celebratory moments.
export function launchConfetti(opts?: {
  particles?: number;
  durationMs?: number;
  spread?: number;
}) {
  if (typeof window === "undefined") return;

  const particles = opts?.particles ?? 140;
  const durationMs = opts?.durationMs ?? 1200;
  const spread = opts?.spread ?? Math.PI; // radians

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.pointerEvents = "none";
  canvas.style.inset = "0";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const centerX = canvas.width / 2;
  const centerY = canvas.height * 0.3;
  const colors = ["#10b981", "#22d3ee", "#f59e0b", "#f97316", "#6366f1"];

  const blobs = Array.from({ length: particles }).map(() => {
    const angle = (Math.random() - 0.5) * spread;
    const speed = 8 + Math.random() * 6;
    return {
      x: centerX,
      y: centerY,
      r: 3 + Math.random() * 3,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.2,
    };
  });

  const start = performance.now();

  const frame = () => {
    const now = performance.now();
    const elapsed = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    blobs.forEach((b) => {
      b.x += b.vx;
      b.y += b.vy;
      b.vy += 0.2; // gravity
      b.rot += b.vr;

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = b.color;
      ctx.fillRect(-b.r, -b.r * 0.6, b.r * 2, b.r * 1.2);
      ctx.restore();
    });

    if (elapsed < durationMs) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  };

  requestAnimationFrame(frame);
}
