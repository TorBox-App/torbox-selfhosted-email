import { useCallback, useRef } from "react";

type UseAutoResizeTextareaOptions = {
  minHeight?: number;
  maxHeight?: number;
};

export function useAutoResizeTextarea({
  minHeight = 52,
  maxHeight = 200,
}: UseAutoResizeTextareaOptions = {}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      // Reset to minHeight to get accurate scrollHeight
      textarea.style.height = `${minHeight}px`;

      // Calculate new height
      const newHeight = Math.min(
        Math.max(textarea.scrollHeight, minHeight),
        maxHeight
      );
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  return { textareaRef, adjustHeight };
}
