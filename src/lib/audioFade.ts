/**
 * Audio fade curves and transitions for Web Audio GainNode.
 * Generated in collaboration with Falken-Smart.
 */

export function fadeIn(
  gainNode: GainNode,
  targetVolume: number,
  durationSeconds: number,
  ctx: AudioContext
): () => void {
  const safeTarget = Math.max(0.0001, Math.min(1, targetVolume));
  if (!ctx || ctx.state === "closed" || durationSeconds <= 0) {
    gainNode.gain.value = safeTarget;
    return () => {};
  }

  const now = ctx.currentTime;
  const startVal = Math.max(0.0001, gainNode.gain.value);

  try {
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(startVal, now);
    gainNode.gain.exponentialRampToValueAtTime(safeTarget, now + durationSeconds);
  } catch {
    gainNode.gain.value = safeTarget;
  }

  const timer = setTimeout(() => {
    try {
      gainNode.gain.setValueAtTime(safeTarget, ctx.currentTime);
    } catch {
      gainNode.gain.value = safeTarget;
    }
  }, durationSeconds * 1000);

  return () => {
    clearTimeout(timer);
    try {
      gainNode.gain.cancelScheduledValues(ctx.currentTime);
    } catch {}
  };
}

export function fadeOut(
  gainNode: GainNode,
  durationSeconds: number,
  ctx: AudioContext,
  onComplete?: () => void
): () => void {
  if (!ctx || ctx.state === "closed" || durationSeconds <= 0) {
    gainNode.gain.value = 0;
    if (onComplete) onComplete();
    return () => {};
  }

  const now = ctx.currentTime;
  const startVal = Math.max(0.0001, gainNode.gain.value);

  try {
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(startVal, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);
  } catch {
    gainNode.gain.value = 0;
  }

  const timer = setTimeout(() => {
    try {
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
    } catch {
      gainNode.gain.value = 0;
    }
    if (onComplete) onComplete();
  }, durationSeconds * 1000);

  return () => {
    clearTimeout(timer);
    try {
      gainNode.gain.cancelScheduledValues(ctx.currentTime);
    } catch {}
  };
}
