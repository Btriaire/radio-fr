/**
 * HTML5 Canvas performance and high-DPI retina optimizer.
 * Designed and sequenced in collaboration with Falken-Smart.
 */

export function setupRetinaCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): { ctx: CanvasRenderingContext2D | null; dpr: number } {
  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return { ctx: null, dpr: 1 };

  ctx.scale(dpr, dpr);
  return { ctx, dpr };
}
