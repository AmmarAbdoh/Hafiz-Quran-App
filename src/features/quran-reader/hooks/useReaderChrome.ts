import { useCallback, useEffect, useRef, useState } from "react";

const AUTO_HIDE_MS = 4000;

export function useReaderChrome(enabled: boolean) {
  const [controlsVisible, setControlsVisible] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const autoHideSuspendedRef = useRef(false);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    if (autoHideSuspendedRef.current) return;
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, AUTO_HIDE_MS);
  }, [clearHideTimer]);

  const showControls = useCallback(() => {
    if (!enabled) return;
    setControlsVisible(true);
    scheduleHide();
  }, [enabled, scheduleHide]);

  const toggleControls = useCallback(() => {
    if (!enabled) return;
    setControlsVisible((visible) => {
      const next = !visible;
      if (next) scheduleHide();
      else clearHideTimer();
      return next;
    });
  }, [clearHideTimer, enabled, scheduleHide]);

  const hideControls = useCallback(() => {
    clearHideTimer();
    setControlsVisible(false);
  }, [clearHideTimer]);

  const suspendAutoHide = useCallback(() => {
    autoHideSuspendedRef.current = true;
    clearHideTimer();
  }, [clearHideTimer]);

  const resumeAutoHide = useCallback(() => {
    autoHideSuspendedRef.current = false;
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  return {
    controlsVisible,
    showControls,
    toggleControls,
    hideControls,
    keepControlsVisible: scheduleHide,
    suspendAutoHide,
    resumeAutoHide,
  };
}
