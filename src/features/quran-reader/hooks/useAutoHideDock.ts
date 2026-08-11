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
    if (!hideTimerRef.current) return;
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
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
      if (!focusWithinRef.current) setExpanded(false);
      hideTimerRef.current = null;
    }, HIDE_DELAY_MS);
  }, [clearHideTimer, enabled, pinned]);

  useEffect(() => {
    clearHideTimer();
    if (!enabled) {
      setExpanded(false);
      return;
    }
    if (pinned) {
      setExpanded(true);
      return;
    }

    setExpanded(true);
    hideTimerRef.current = setTimeout(() => {
      if (!focusWithinRef.current) setExpanded(false);
      hideTimerRef.current = null;
    }, INITIAL_HIDE_DELAY_MS);
    return clearHideTimer;
  }, [clearHideTimer, enabled, pinned]);

  const handleFocusCapture = () => {
    focusWithinRef.current = true;
    show();
  };

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
    handleMouseEnter: show,
    handleMouseLeave: scheduleHide,
    handleFocusCapture,
    handleBlurCapture,
    handleFocus,
  };
}
