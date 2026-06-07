import { useCallback, useEffect, useRef, useState } from "react";

const HIDE_DELAY_MS = 2800;
const INITIAL_HIDE_DELAY_MS = 1800;

interface UseAutoHideDockOptions {
  pinned?: boolean;
  enabled?: boolean;
}

export function useAutoHideDock(options: UseAutoHideDockOptions = {}) {
  const pinned = options.pinned ?? false;
  const enabled = options.enabled ?? true;
  const [expanded, setExpanded] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusWithinRef = useRef(false);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    if (!enabled || pinned) return;
    clearHideTimer();
    setExpanded(true);
  }, [clearHideTimer, enabled, pinned]);

  const scheduleHide = useCallback(() => {
    if (!enabled || pinned) return;
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      if (!focusWithinRef.current) {
        setExpanded(false);
      }
    }, HIDE_DELAY_MS);
  }, [clearHideTimer, enabled, pinned]);

  useEffect(() => {
    if (!enabled) {
      clearHideTimer();
      setExpanded(false);
      return;
    }

    if (pinned) {
      clearHideTimer();
      setExpanded(true);
      return;
    }

    setExpanded(true);
    const timer = setTimeout(() => setExpanded(false), INITIAL_HIDE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [clearHideTimer, enabled, pinned]);

  useEffect(() => clearHideTimer, [clearHideTimer]);

  const handleMouseEnter = show;
  const handleMouseLeave = scheduleHide;

  const handleFocusCapture = show;

  const handleBlurCapture = (event: React.FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget as Node | null;
    if (next && event.currentTarget.contains(next)) return;

    focusWithinRef.current = false;
    scheduleHide();
  };

  const handleFocus = () => {
    focusWithinRef.current = true;
    show();
  };

  return {
    expanded: pinned ? true : expanded,
    show,
    scheduleHide,
    handleMouseEnter,
    handleMouseLeave,
    handleFocusCapture,
    handleBlurCapture,
    handleFocus,
  };
}
