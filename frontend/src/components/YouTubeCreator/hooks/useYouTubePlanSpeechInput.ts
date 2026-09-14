/**
 * Web Speech dictation for Plan Your Video idea field.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { youtubePlanSpeechLang } from "../components/youtubePlanSpeechLang";

type SpeechRecognitionConstructor = new () => YouTubePlanSpeechRecognition;

interface YouTubePlanSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: YouTubePlanSpeechResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface YouTubePlanSpeechResultEvent {
  results?: ArrayLike<ArrayLike<{ transcript?: string }> & { isFinal?: boolean }>;
}

function speechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function appendYouTubePlanTranscript(current: string, transcript: string): string {
  const spoken = transcript.trim();
  if (!spoken) {
    return current;
  }
  const base = current.trim();
  return base ? `${base} ${spoken}` : spoken;
}

export function useYouTubePlanSpeechInput(language: string) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<YouTubePlanSpeechRecognition | null>(null);
  const onAppendRef = useRef<(next: string) => void>(() => undefined);
  const currentRef = useRef("");
  const Ctor = speechRecognitionCtor();
  const isSupported = Boolean(Ctor);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch (stopError) {
      console.error("[YouTubePlan] Speech stop failed", stopError);
    }
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  useEffect(() => () => stopListening(), [stopListening]);

  const startListening = useCallback(
    (currentIdea: string, onAppend: (next: string) => void) => {
      if (!Ctor) {
        setError("Speech recognition is not supported in this browser.");
        return;
      }
      try {
        stopListening();
        setError(null);
        currentRef.current = currentIdea;
        onAppendRef.current = onAppend;
        const recognition = new Ctor();
        recognition.lang = youtubePlanSpeechLang(language);
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
          const results = event.results;
          if (!results || results.length < 1) {
            return;
          }
          const last = results[results.length - 1];
          const transcript = last?.[0]?.transcript || "";
          if (!last?.isFinal) {
            return;
          }
          const next = appendYouTubePlanTranscript(currentRef.current, transcript);
          currentRef.current = next;
          try {
            console.info("[YouTubePlan] Speech transcript appended", {
              transcriptLen: transcript.trim().length,
            });
            onAppendRef.current(next);
          } catch (appendError) {
            console.error("[YouTubePlan] Speech append failed", appendError);
          }
        };
        recognition.onerror = (event) => {
          const code = event.error || "unknown";
          if (code === "not-allowed" || code === "service-not-allowed") {
            setError("Microphone access denied. Allow the microphone to dictate your topic.");
          } else if (code === "network") {
            setError("Speech recognition network error. Check your connection and try again.");
          } else if (code !== "aborted") {
            setError("Could not hear that. Please try the microphone again.");
          }
          console.warn("[YouTubePlan] Speech recognition error", { code });
          setIsListening(false);
        };
        recognition.onend = () => {
          setIsListening(false);
          recognitionRef.current = null;
        };
        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
        console.info("[YouTubePlan] Speech listening started", {
          lang: recognition.lang,
        });
      } catch (startError) {
        console.error("[YouTubePlan] Speech start failed", startError);
        setError("Could not start the microphone. Please try again.");
        setIsListening(false);
      }
    },
    [Ctor, language, stopListening],
  );

  return {
    isSupported,
    isListening,
    error,
    startListening,
    stopListening,
  };
}
