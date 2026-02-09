import * as chrono from "chrono-node";
import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";

type NaturalDateResult = {
  parsedDate: Date | null;
  formattedPreview: string | null;
};

export function useNaturalDateParser(text: string): NaturalDateResult {
  const [result, setResult] = useState<NaturalDateResult>({
    parsedDate: null,
    formattedPreview: null,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (!text.trim()) {
      setResult({ parsedDate: null, formattedPreview: null });
      return;
    }

    timerRef.current = setTimeout(() => {
      const parsed = chrono.casual.parseDate(text, new Date(), {
        forwardDate: true,
      });

      if (parsed) {
        setResult({
          parsedDate: parsed,
          formattedPreview: format(parsed, "EEEE, MMMM d, yyyy 'at' h:mm a"),
        });
      } else {
        setResult({ parsedDate: null, formattedPreview: null });
      }
    }, 300);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [text]);

  return result;
}
