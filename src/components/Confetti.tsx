import { useEffect, useRef } from "react";

const SESSION_KEY = "confetti_fired";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

const COLORS = [
  "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff",
  "#ff922b", "#cc5de8", "#20c997", "#f06595",
];

function createParticle(w: number): Particle {
  return {
    x: Math.random() * w,
    y: -10,
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 3 + 2,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: Math.random() * 8 + 4,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 6,
    opacity: 1,
  };
}

export function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // 같은 세션에서 이미 터진 적 있으면 스킵
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: Particle[] = [];
    const TOTAL = 180;
    let spawned = 0;
    let rafId: number;
    let frame = 0;

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 처음 60프레임 동안 파티클 생성
      if (spawned < TOTAL && frame < 60) {
        const batch = Math.ceil(TOTAL / 60);
        for (let i = 0; i < batch && spawned < TOTAL; i++) {
          particles.push(createParticle(canvas.width));
          spawned++;
        }
      }
      frame++;

      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // 중력
        p.vx *= 0.99; // 공기저항
        p.rotation += p.rotationSpeed;

        // 화면 아래 80% 지점부터 페이드아웃
        const fadeStart = canvas.height * 0.8;
        if (p.y > fadeStart) {
          p.opacity = Math.max(0, 1 - (p.y - fadeStart) / (canvas.height * 0.2));
        }

        if (p.opacity <= 0) continue;
        alive = true;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      if (alive || spawned < TOTAL) {
        rafId = requestAnimationFrame(tick);
      } else {
        canvas.style.display = "none";
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
