"use client";
import { useEffect, useRef, useState } from "react";

export type GameType = "tetris" | "invader" | "pong";

interface RetroGamesCanvasProps {
  game: GameType;
  scale: number;
  width: number;
  height: number;
  clickAction: number; // incremented whenever center button is pressed
  wheelDelta: number;  // negative = left/up, positive = right/down
  onExit: () => void;
}

export default function RetroGamesCanvas({
  game,
  scale,
  width,
  height,
  clickAction,
  wheelDelta,
  onExit,
}: RetroGamesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);

  // References for keeping state inside requestAnimationFrame loop without stale closures
  const stateRef = useRef<{
    game: GameType;
    score: number;
    gameOver: boolean;
    paused: boolean;
    // Tetris
    grid: number[][]; // 10x20
    currentPiece: { shape: number[][]; x: number; y: number; color: string } | null;
    dropTimer: number;
    dropInterval: number;
    // Invaders
    shipX: number;
    bullets: { x: number; y: number; vy: number }[];
    invaders: { x: number; y: number; alive: boolean; type: number }[];
    invaderDir: number;
    invaderTimer: number;
    invaderInterval: number;
    alienBombs: { x: number; y: number; vy: number }[];
    lives: number;
    // Pong
    p1Y: number;
    p2Y: number;
    ballX: number;
    ballY: number;
    ballVx: number;
    ballVy: number;
    p1Score: number;
    p2Score: number;
  }>({
    game,
    score: 0,
    gameOver: false,
    paused: false,
    grid: Array.from({ length: 20 }, () => Array(10).fill(0)),
    currentPiece: null,
    dropTimer: 0,
    dropInterval: 48,
    shipX: 50,
    bullets: [],
    invaders: [],
    invaderDir: 1,
    invaderTimer: 0,
    invaderInterval: 30,
    alienBombs: [],
    lives: 3,
    p1Y: 40,
    p2Y: 40,
    ballX: 50,
    ballY: 50,
    ballVx: 1.2,
    ballVy: 0.9,
    p1Score: 0,
    p2Score: 0,
  });

  const lastClickRef = useRef(clickAction);
  const lastWheelRef = useRef(wheelDelta);

  // ----------------------------------------------------
  // TETRIS PIECES
  // ----------------------------------------------------
  const SHAPES = [
    // I
    [[1, 1, 1, 1]],
    // J
    [[1, 0, 0], [1, 1, 1]],
    // L
    [[0, 0, 1], [1, 1, 1]],
    // O
    [[1, 1], [1, 1]],
    // S
    [[0, 1, 1], [1, 1, 0]],
    // T
    [[0, 1, 0], [1, 1, 1]],
    // Z
    [[1, 1, 0], [0, 1, 1]],
  ];

  const spawnPiece = () => {
    const s = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const p = {
      shape: s,
      x: Math.floor((10 - s[0].length) / 2),
      y: 0,
      color: "#18324f",
    };
    // Collision on spawn = game over
    if (checkCollision(p.shape, p.x, p.y, stateRef.current.grid)) {
      stateRef.current.gameOver = true;
      setGameOver(true);
      return null;
    }
    return p;
  };

  const checkCollision = (shape: number[][], posX: number, posY: number, grid: number[][]) => {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const newX = posX + c;
          const newY = posY + r;
          if (newX < 0 || newX >= 10 || newY >= 20) return true;
          if (newY >= 0 && grid[newY][newX]) return true;
        }
      }
    }
    return false;
  };

  const rotateMatrix = (matrix: number[][]) => {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const res: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        res[c][rows - 1 - r] = matrix[r][c];
      }
    }
    return res;
  };

  const initInvaders = () => {
    const invaders = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 7; c++) {
        invaders.push({
          x: 18 + c * 11,
          y: 12 + r * 10,
          alive: true,
          type: r,
        });
      }
    }
    return invaders;
  };

  // Reset or Init game
  useEffect(() => {
    stateRef.current.game = game;
    stateRef.current.gameOver = false;
    stateRef.current.score = 0;
    setGameOver(false);
    setScore(0);

    if (game === "tetris") {
      stateRef.current.grid = Array.from({ length: 20 }, () => Array(10).fill(0));
      stateRef.current.currentPiece = spawnPiece();
      stateRef.current.dropTimer = 0;
      stateRef.current.dropInterval = 42;
    } else if (game === "invader") {
      stateRef.current.shipX = 50;
      stateRef.current.bullets = [];
      stateRef.current.invaders = initInvaders();
      stateRef.current.alienBombs = [];
      stateRef.current.invaderDir = 1;
      stateRef.current.invaderInterval = 32;
      stateRef.current.invaderTimer = 0;
      stateRef.current.lives = 3;
    } else if (game === "pong") {
      stateRef.current.p1Y = 40;
      stateRef.current.p2Y = 40;
      stateRef.current.ballX = 50;
      stateRef.current.ballY = 50;
      stateRef.current.ballVx = 1.1;
      stateRef.current.ballVy = 0.8;
      stateRef.current.p1Score = 0;
      stateRef.current.p2Score = 0;
    }
  }, [game]);

  // Handle Wheel rotation events from outside
  useEffect(() => {
    if (wheelDelta === lastWheelRef.current) return;
    const diff = wheelDelta - lastWheelRef.current;
    lastWheelRef.current = wheelDelta;
    const st = stateRef.current;
    if (st.gameOver || st.paused) return;

    if (game === "tetris" && st.currentPiece) {
      const step = diff > 0 ? 1 : -1;
      const newX = st.currentPiece.x + step;
      if (!checkCollision(st.currentPiece.shape, newX, st.currentPiece.y, st.grid)) {
        st.currentPiece.x = newX;
      }
    } else if (game === "invader") {
      const step = diff > 0 ? 4 : -4;
      st.shipX = Math.max(6, Math.min(94, st.shipX + step));
    } else if (game === "pong") {
      const step = diff > 0 ? 5 : -5;
      st.p1Y = Math.max(5, Math.min(75, st.p1Y + step));
    }
  }, [wheelDelta, game]);

  // Handle Center button click (Action / Rotate / Fire / Serve)
  useEffect(() => {
    if (clickAction === lastClickRef.current) return;
    lastClickRef.current = clickAction;
    const st = stateRef.current;

    if (st.gameOver) {
      // Restart game
      st.gameOver = false;
      st.score = 0;
      setGameOver(false);
      setScore(0);
      if (game === "tetris") {
        st.grid = Array.from({ length: 20 }, () => Array(10).fill(0));
        st.currentPiece = spawnPiece();
      } else if (game === "invader") {
        st.shipX = 50;
        st.bullets = [];
        st.invaders = initInvaders();
        st.alienBombs = [];
        st.lives = 3;
      } else if (game === "pong") {
        st.p1Score = 0;
        st.p2Score = 0;
        st.ballX = 50;
        st.ballY = 50;
        st.ballVx = 1.1;
        st.ballVy = 0.8;
      }
      return;
    }

    if (game === "tetris" && st.currentPiece) {
      // Rotate piece
      const rotated = rotateMatrix(st.currentPiece.shape);
      if (!checkCollision(rotated, st.currentPiece.x, st.currentPiece.y, st.grid)) {
        st.currentPiece.shape = rotated;
      } else if (!checkCollision(rotated, st.currentPiece.x - 1, st.currentPiece.y, st.grid)) {
        st.currentPiece.x -= 1;
        st.currentPiece.shape = rotated;
      } else if (!checkCollision(rotated, st.currentPiece.x + 1, st.currentPiece.y, st.grid)) {
        st.currentPiece.x += 1;
        st.currentPiece.shape = rotated;
      }
    } else if (game === "invader") {
      // Fire bullet if less than 3 on screen
      if (st.bullets.length < 3) {
        st.bullets.push({ x: st.shipX, y: 88, vy: -2.8 });
      }
    } else if (game === "pong") {
      // Fast serve if ball is slow
      if (Math.abs(st.ballVx) < 0.5) {
        st.ballVx = 1.2;
        st.ballVy = 0.9;
      }
    }
  }, [clickAction, game]);

  // Main game animation loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const st = stateRef.current;
      const W = canvas.width;
      const H = canvas.height;

      // Clear with retro LCD background
      ctx.fillStyle = "#bad5f5";
      ctx.fillRect(0, 0, W, H);

      // Subtle scanline pattern
      ctx.fillStyle = "rgba(40, 70, 110, 0.05)";
      for (let y = 0; y < H; y += 3) {
        ctx.fillRect(0, y, W, 1);
      }

      if (st.game === "tetris") {
        updateAndRenderTetris(ctx, W, H, st);
      } else if (st.game === "invader") {
        updateAndRenderInvader(ctx, W, H, st);
      } else if (st.game === "pong") {
        updateAndRenderPong(ctx, W, H, st);
      }

      // Game Over Overlay
      if (st.gameOver) {
        ctx.fillStyle = "rgba(18, 38, 64, 0.85)";
        ctx.fillRect(W * 0.1, H * 0.25, W * 0.8, H * 0.5);
        ctx.strokeStyle = "#bad5f5";
        ctx.lineWidth = 1;
        ctx.strokeRect(W * 0.1, H * 0.25, W * 0.8, H * 0.5);

        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.round(10 * scale)}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText("FIN DE PARTIE", W / 2, H * 0.44);

        ctx.fillStyle = "#bad5f5";
        ctx.font = `${Math.round(7.5 * scale)}px monospace`;
        ctx.fillText(`SCORE: ${st.score}`, W / 2, H * 0.56);
        ctx.fillText("PRESSER CENTRE", W / 2, H * 0.67);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [scale]);

  // ----------------------------------------------------------------
  // TETRIS RENDER & UPDATE
  // ----------------------------------------------------------------
  const updateAndRenderTetris = (
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    st: any
  ) => {
    const cols = 10;
    const rows = 20;
    const cellSize = Math.floor(Math.min((H - 8) / rows, (W * 0.5) / cols));
    const startX = Math.round(12 * scale);
    const startY = Math.round(4 * scale);

    // Update drop logic
    if (!st.gameOver && st.currentPiece) {
      st.dropTimer++;
      if (st.dropTimer >= st.dropInterval) {
        st.dropTimer = 0;
        const nextY = st.currentPiece.y + 1;
        if (!checkCollision(st.currentPiece.shape, st.currentPiece.x, nextY, st.grid)) {
          st.currentPiece.y = nextY;
        } else {
          // Lock piece
          for (let r = 0; r < st.currentPiece.shape.length; r++) {
            for (let c = 0; c < st.currentPiece.shape[r].length; c++) {
              if (st.currentPiece.shape[r][c]) {
                const py = st.currentPiece.y + r;
                const px = st.currentPiece.x + c;
                if (py >= 0 && py < rows && px >= 0 && px < cols) {
                  st.grid[py][px] = 1;
                }
              }
            }
          }

          // Check line clears
          let cleared = 0;
          for (let r = rows - 1; r >= 0; r--) {
            if (st.grid[r].every((val: number) => val === 1)) {
              st.grid.splice(r, 1);
              st.grid.unshift(Array(cols).fill(0));
              cleared++;
              r++;
            }
          }
          if (cleared > 0) {
            const add = cleared === 1 ? 100 : cleared === 2 ? 300 : cleared === 3 ? 500 : 800;
            st.score += add;
            setScore(st.score);
            st.dropInterval = Math.max(12, st.dropInterval - 1);
          }

          st.currentPiece = spawnPiece();
        }
      }
    }

    // Draw Board boundary
    ctx.strokeStyle = "#1b3552";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(startX - 1, startY - 1, cols * cellSize + 2, rows * cellSize + 2);

    // Draw locked grid cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (st.grid[r][c]) {
          ctx.fillStyle = "#1e3a5f";
          ctx.fillRect(startX + c * cellSize, startY + r * cellSize, cellSize - 1, cellSize - 1);
          ctx.fillStyle = "#3b6a9e";
          ctx.fillRect(startX + c * cellSize + 1, startY + r * cellSize + 1, cellSize - 3, 1);
        }
      }
    }

    // Draw falling piece
    if (st.currentPiece) {
      ctx.fillStyle = "#0d2038";
      for (let r = 0; r < st.currentPiece.shape.length; r++) {
        for (let c = 0; c < st.currentPiece.shape[r].length; c++) {
          if (st.currentPiece.shape[r][c]) {
            const px = startX + (st.currentPiece.x + c) * cellSize;
            const py = startY + (st.currentPiece.y + r) * cellSize;
            ctx.fillRect(px, py, cellSize - 1, cellSize - 1);
            ctx.fillStyle = "#4a82bf";
            ctx.fillRect(px + 1, py + 1, cellSize - 3, 1);
            ctx.fillStyle = "#0d2038";
          }
        }
      }
    }

    // Right Sidebar info
    const infoX = startX + cols * cellSize + Math.round(14 * scale);
    ctx.textAlign = "left";
    ctx.fillStyle = "#162f4d";
    ctx.font = `bold ${Math.round(8 * scale)}px monospace`;
    ctx.fillText("TETRIS", infoX, startY + Math.round(12 * scale));

    ctx.font = `${Math.round(7 * scale)}px monospace`;
    ctx.fillText("SCORE", infoX, startY + Math.round(26 * scale));
    ctx.font = `bold ${Math.round(9 * scale)}px monospace`;
    ctx.fillText(`${st.score}`, infoX, startY + Math.round(38 * scale));

    ctx.font = `${Math.round(6.5 * scale)}px monospace`;
    ctx.fillStyle = "#43658b";
    ctx.fillText("MOLETTE: G/D", infoX, startY + Math.round(56 * scale));
    ctx.fillText("CENTRE: PIVOT", infoX, startY + Math.round(66 * scale));
  };

  // ----------------------------------------------------------------
  // SPACE INVADERS RENDER & UPDATE
  // ----------------------------------------------------------------
  const updateAndRenderInvader = (
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    st: any
  ) => {
    // March invaders
    if (!st.gameOver) {
      st.invaderTimer++;
      if (st.invaderTimer >= st.invaderInterval) {
        st.invaderTimer = 0;
        let hitEdge = false;
        for (const inv of st.invaders) {
          if (!inv.alive) continue;
          if ((inv.x >= 88 && st.invaderDir > 0) || (inv.x <= 8 && st.invaderDir < 0)) {
            hitEdge = true;
            break;
          }
        }
        if (hitEdge) {
          st.invaderDir = -st.invaderDir;
          for (const inv of st.invaders) {
            inv.y += 5;
            if (inv.alive && inv.y >= 78) {
              st.gameOver = true;
              setGameOver(true);
            }
          }
        } else {
          for (const inv of st.invaders) {
            inv.x += st.invaderDir * 3.5;
          }
        }

        // Alien random bomb dropping
        const livingInvaders = st.invaders.filter((i: any) => i.alive);
        if (livingInvaders.length > 0 && Math.random() < 0.45 && st.alienBombs.length < 3) {
          const shooter = livingInvaders[Math.floor(Math.random() * livingInvaders.length)];
          st.alienBombs.push({ x: shooter.x, y: shooter.y + 4, vy: 1.4 });
        }
      }

      // Update player bullets
      for (let i = st.bullets.length - 1; i >= 0; i--) {
        const b = st.bullets[i];
        b.y += b.vy;
        if (b.y < 2) {
          st.bullets.splice(i, 1);
          continue;
        }
        // Check hit against invaders
        for (const inv of st.invaders) {
          if (!inv.alive) continue;
          if (Math.abs(b.x - inv.x) < 4.5 && Math.abs(b.y - inv.y) < 4.5) {
            inv.alive = false;
            st.bullets.splice(i, 1);
            st.score += 20;
            setScore(st.score);
            st.invaderInterval = Math.max(8, st.invaderInterval - 1);
            break;
          }
        }
      }

      // Check all dead -> new wave
      if (st.invaders.every((inv: any) => !inv.alive)) {
        st.invaders = initInvaders();
        st.invaderInterval = Math.max(10, st.invaderInterval - 4);
      }

      // Update alien bombs
      for (let i = st.alienBombs.length - 1; i >= 0; i--) {
        const bomb = st.alienBombs[i];
        bomb.y += bomb.vy;
        if (bomb.y > 96) {
          st.alienBombs.splice(i, 1);
          continue;
        }
        // Hit player ship
        if (Math.abs(bomb.x - st.shipX) < 6 && bomb.y >= 84 && bomb.y <= 92) {
          st.alienBombs.splice(i, 1);
          st.lives--;
          if (st.lives <= 0) {
            st.gameOver = true;
            setGameOver(true);
          }
        }
      }
    }

    // Top status line
    ctx.fillStyle = "#18324f";
    ctx.font = `bold ${Math.round(7.5 * scale)}px monospace`;
    ctx.textAlign = "left";
    ctx.fillText(`SCORE: ${st.score}`, Math.round(6 * scale), Math.round(9 * scale));
    ctx.textAlign = "right";
    ctx.fillText(`VIES: ${st.lives}`, W - Math.round(6 * scale), Math.round(9 * scale));

    // Draw Invaders
    ctx.fillStyle = "#183457";
    for (const inv of st.invaders) {
      if (!inv.alive) continue;
      const px = Math.round((inv.x / 100) * W);
      const py = Math.round((inv.y / 100) * H);
      const sz = Math.round(4.5 * scale);
      // Pixelated classic invader shape
      ctx.fillRect(px - sz, py - sz * 0.6, sz * 2, sz * 1.2);
      ctx.fillRect(px - sz * 0.5, py + sz * 0.6, sz, sz * 0.4);
    }

    // Draw Bullets
    ctx.fillStyle = "#0c2138";
    for (const b of st.bullets) {
      const bx = Math.round((b.x / 100) * W);
      const by = Math.round((b.y / 100) * H);
      ctx.fillRect(bx - 1, by, 2, Math.round(4 * scale));
    }

    // Draw Alien Bombs
    ctx.fillStyle = "#8a3a3a";
    for (const bomb of st.alienBombs) {
      const bx = Math.round((bomb.x / 100) * W);
      const by = Math.round((bomb.y / 100) * H);
      ctx.fillRect(bx - 1, by, 2, Math.round(3 * scale));
    }

    // Draw Player Ship Cannon
    const sx = Math.round((st.shipX / 100) * W);
    const sy = Math.round(0.88 * H);
    ctx.fillStyle = "#132d4b";
    ctx.fillRect(sx - Math.round(7 * scale), sy, Math.round(14 * scale), Math.round(4.5 * scale));
    ctx.fillRect(sx - Math.round(2 * scale), sy - Math.round(3 * scale), Math.round(4 * scale), Math.round(3 * scale));
  };

  // ----------------------------------------------------------------
  // PING-PONG RENDER & UPDATE
  // ----------------------------------------------------------------
  const updateAndRenderPong = (
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    st: any
  ) => {
    const paddleH = Math.round(22 * scale);
    const paddleW = Math.round(3.5 * scale);

    if (!st.gameOver) {
      // Ball Physics
      st.ballX += st.ballVx;
      st.ballY += st.ballVy;

      // Bounce top & bottom
      if (st.ballY <= 4) {
        st.ballY = 4;
        st.ballVy = Math.abs(st.ballVy);
      } else if (st.ballY >= 96) {
        st.ballY = 96;
        st.ballVy = -Math.abs(st.ballVy);
      }

      // AI Paddle tracking with slight delay
      const aiTarget = st.ballY - 10;
      st.p2Y += (aiTarget - st.p2Y) * 0.12;
      st.p2Y = Math.max(4, Math.min(76, st.p2Y));

      // Player 1 Paddle collision (Left)
      if (st.ballX <= 8 && st.ballX >= 4) {
        if (st.ballY >= st.p1Y - 2 && st.ballY <= st.p1Y + 24) {
          st.ballX = 8.1;
          st.ballVx = Math.abs(st.ballVx) * 1.05;
          const deltaY = (st.ballY - (st.p1Y + 11)) / 11;
          st.ballVy = deltaY * 1.4;
          st.score += 10;
          setScore(st.score);
        }
      }

      // Player 2 / AI Paddle collision (Right)
      if (st.ballX >= 92 && st.ballX <= 96) {
        if (st.ballY >= st.p2Y - 2 && st.ballY <= st.p2Y + 24) {
          st.ballX = 91.9;
          st.ballVx = -Math.abs(st.ballVx) * 1.04;
          const deltaY = (st.ballY - (st.p2Y + 11)) / 11;
          st.ballVy = deltaY * 1.3;
        }
      }

      // Score Left (AI missed)
      if (st.ballX > 99) {
        st.p1Score++;
        st.ballX = 50;
        st.ballY = 50;
        st.ballVx = -1.1;
        st.ballVy = (Math.random() - 0.5) * 1.2;
        if (st.p1Score >= 7) {
          st.gameOver = true;
          setGameOver(true);
        }
      }

      // Score Right (Player missed)
      if (st.ballX < 1) {
        st.p2Score++;
        st.ballX = 50;
        st.ballY = 50;
        st.ballVx = 1.1;
        st.ballVy = (Math.random() - 0.5) * 1.2;
        if (st.p2Score >= 7) {
          st.gameOver = true;
          setGameOver(true);
        }
      }
    }

    // Center dotted net
    ctx.strokeStyle = "rgba(25, 52, 85, 0.25)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Score display
    ctx.fillStyle = "#1a395e";
    ctx.font = `bold ${Math.round(11 * scale)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`${st.p1Score}`, W * 0.35, Math.round(14 * scale));
    ctx.fillText(`${st.p2Score}`, W * 0.65, Math.round(14 * scale));

    // Player Paddle (Left)
    const p1Px = Math.round(4 * scale);
    const p1Py = Math.round((st.p1Y / 100) * H);
    ctx.fillStyle = "#122a46";
    ctx.fillRect(p1Px, p1Py, paddleW, paddleH);

    // AI Paddle (Right)
    const p2Px = W - Math.round(4 * scale) - paddleW;
    const p2Py = Math.round((st.p2Y / 100) * H);
    ctx.fillStyle = "#1f4570";
    ctx.fillRect(p2Px, p2Py, paddleW, paddleH);

    // Ball
    const bx = Math.round((st.ballX / 100) * W);
    const by = Math.round((st.ballY / 100) * H);
    const ballSz = Math.round(3.2 * scale);
    ctx.fillStyle = "#0f233a";
    ctx.fillRect(bx - ballSz / 2, by - ballSz / 2, ballSz, ballSz);
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
}
