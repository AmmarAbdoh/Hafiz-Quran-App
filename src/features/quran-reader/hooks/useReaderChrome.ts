import { useCallback, useState } from "react";

/**
 * Whether the reader shows its page navigation.
 *
 * This used to be a timer: a tap revealed the controls and four seconds later
 * they left again on their own. Combined with a tap handler that fired on any
 * pointer release, that is what made the reader's chrome feel like it appeared
 * and vanished at random. Now the controls are simply on, and stay on until
 * the reader asks for a bare page.
 */
export function useReaderChrome(enabled: boolean) {
  const [controlsVisible, setControlsVisible] = useState(true);

  const toggleControls = useCallback(() => {
    if (!enabled) return;
    setControlsVisible((visible) => !visible);
  }, [enabled]);

  return { controlsVisible, toggleControls };
}
