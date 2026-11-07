"use client";

import { useRef } from 'react';

export interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwipe?: (direction: 'left' | 'right' | 'up' | 'down') => void;
  minDistance?: number;
  maxDurationMs?: number;
  enableHaptics?: boolean;
}

export interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchCancel: () => void;
}

export function useSwipeGesture(options: SwipeGestureOptions): SwipeHandlers {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onSwipe,
    minDistance = 40,
    maxDurationMs = 600,
    enableHaptics = true,
  } = options;

  const startX = useRef<number>(0);
  const startY = useRef<number>(0);
  const startTime = useRef<number>(0);

  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    startTime.current = Date.now();
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - startX.current;
    const deltaY = touch.clientY - startY.current;
    const duration = Date.now() - startTime.current;

    if (duration <= maxDurationMs) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > 1.3 * absY && absX >= minDistance) {
        if (deltaX < 0) {
          onSwipeLeft?.();
          onSwipe?.('left');
        } else {
          onSwipeRight?.();
          onSwipe?.('right');
        }
        if (enableHaptics && typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(30);
        }
      } else if (absY > 1.3 * absX && absY >= minDistance) {
        if (deltaY < 0) {
          onSwipeUp?.();
          onSwipe?.('up');
        } else {
          onSwipeDown?.();
          onSwipe?.('down');
        }
        if (enableHaptics && typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(25);
        }
      }
    }
  };

  const onTouchCancel = () => {
    startX.current = 0;
    startY.current = 0;
    startTime.current = 0;
  };

  return {
    onTouchStart,
    onTouchEnd,
    onTouchCancel,
  };
}

export default useSwipeGesture;