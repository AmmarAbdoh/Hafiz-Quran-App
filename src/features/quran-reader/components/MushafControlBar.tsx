import type { ReactNode } from "react";

interface MushafControlBarProps {
  pageControls: ReactNode;
  onKeepVisible: () => void;
  onSuspendAutoHide: () => void;
  onResumeAutoHide: () => void;
}

/**
 * The strip revealed by tapping the page. It replaces the folio line and carries
 * page navigation alone: listening, surahs, search and the reading preferences
 * are reached from the header menu. Its height stays within the space the dock
 * already reserves, so revealing it never reflows the mushaf.
 */
export function MushafControlBar({
  pageControls,
  onKeepVisible,
  onSuspendAutoHide,
  onResumeAutoHide,
}: MushafControlBarProps) {
  return (
    <div
      className="flex min-h-13 items-center justify-center px-2 sm:px-3"
      onPointerDown={onKeepVisible}
      onFocusCapture={onSuspendAutoHide}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onResumeAutoHide();
        }
      }}
    >
      {pageControls}
    </div>
  );
}
