"use client";
import { useRef, useCallback } from "react";

export interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  minDistance?: number;
  maxDurationMs?: number;
}

export interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchCancel: () => void;
}

/**
 * Mobile touch swipe detection hook for station navigation and panel expansion.
 * Sequenced and engineered with Falken-Smart.
 */
export function useSwipeGesture(options: SwipeGestureOptions): SwipeHandlers {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    minDistance = 45,
    maxDurationMs = 600,
  } = options;

  const touchRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
  } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      touchRef.current = null;
      return;
    }
    const touch = e.touches[0];
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
    };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchRef.current || e.changedTouches.length === 0) {
        touchRef.current = null;
        return;
      }

      const { startX, startY, startTime } = touchRef.current;
      touchRef.current = null;

      const duration = Date.now() - startTime;
      if (duration > maxDurationMs) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Horizontal swipe dominant
      if (absX >= minDistance && absX > 1.4 * absY) {
        if (deltaX < 0) {
          onSwipeLeft?.();
        } else {
          onSwipeRight?.();
        }
        return;
      }

      // Vertical swipe dominant
      if (absY >= minDistance && absY > 1.4 * absX) {
        if (deltaY < 0) {
          onSwipeUp?.();
        } else {
          onSwipeDown?.();
        }
      }
    },
    [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, minDistance, maxDurationMs]
  );

  const onTouchCancel = useCallback(() => {
    touchRef.current = null;
  }, []);

  return { onTouchStart, onTouchEnd, onTouchCancel };
}
