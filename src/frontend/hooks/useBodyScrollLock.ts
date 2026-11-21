import { useEffect } from 'react';

let activeLockCount = 0;
let savedScrollY = 0;
let previousStyles: {
  htmlOverflow: string;
  htmlOverscrollBehavior: string;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  bodyPaddingRight: string;
  bodyOverscrollBehavior: string;
} | null = null;

function applyBodyScrollLock() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (activeLockCount === 0) {
    const html = document.documentElement;
    const body = document.body;
    savedScrollY = window.scrollY || window.pageYOffset || 0;
    const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);

    previousStyles = {
      htmlOverflow: html.style.overflow,
      htmlOverscrollBehavior: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyPaddingRight: body.style.paddingRight,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
    };

    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    body.style.position = 'fixed';
    body.style.top = `-${savedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  activeLockCount += 1;
}

function releaseBodyScrollLock() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (activeLockCount <= 0) return;

  activeLockCount -= 1;

  if (activeLockCount === 0 && previousStyles) {
    const html = document.documentElement;
    const body = document.body;

    html.style.overflow = previousStyles.htmlOverflow;
    html.style.overscrollBehavior = previousStyles.htmlOverscrollBehavior;
    body.style.overflow = previousStyles.bodyOverflow;
    body.style.position = previousStyles.bodyPosition;
    body.style.top = previousStyles.bodyTop;
    body.style.left = previousStyles.bodyLeft;
    body.style.right = previousStyles.bodyRight;
    body.style.width = previousStyles.bodyWidth;
    body.style.paddingRight = previousStyles.bodyPaddingRight;
    body.style.overscrollBehavior = previousStyles.bodyOverscrollBehavior;

    const restoreY = savedScrollY;
    previousStyles = null;
    window.scrollTo(0, restoreY);
  }
}

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    applyBodyScrollLock();
    return () => {
      releaseBodyScrollLock();
    };
  }, [locked]);
}
