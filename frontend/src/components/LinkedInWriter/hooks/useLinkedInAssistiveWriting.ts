import { useCallback, useEffect, useRef, useState } from 'react';
import {
  linkedInAssistiveWritingApi,
  mapAssistiveWritingError,
  type LinkedInAssistiveSuggestion,
} from '../services/linkedInAssistiveWritingApi';

const TYPING_DEBOUNCE_MS = 3000;
const CONTINUE_COOLDOWN_MS = 15000;
const CTA_DISMISS_COOLDOWN_MS = 15000;
const MIN_TOTAL_CHARS_FIRST = 50;
const MIN_USER_ADDED_CHARS_FIRST = 5;
const MIN_TOTAL_CHARS_CONTINUE = 100;
const MIN_USER_ADDED_CHARS_CONTINUE = 5;

interface UseLinkedInAssistiveWritingOptions {
  enabled: boolean;
  draft: string;
  getTextarea: () => HTMLTextAreaElement | null;
  onDraftChange: (value: string) => void;
  onInsertWithPreview?: (text: string, caretIndex: number) => void;
}

export function useLinkedInAssistiveWriting({
  enabled,
  draft,
  getTextarea,
  onDraftChange,
  onInsertWithPreview,
}: UseLinkedInAssistiveWritingOptions) {
  const [suggestion, setSuggestion] = useState<LinkedInAssistiveSuggestion | null>(null);
  const [allSuggestions, setAllSuggestions] = useState<LinkedInAssistiveSuggestion[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const enablePromptTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ctaDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastGeneratedAtRef = useRef(0);
  const ctaCooldownUntilRef = useRef<number | null>(null);
  const apiCooldownUntilRef = useRef<number | null>(null);
  const hasShownFirstRef = useRef(false);
  const isGeneratingRef = useRef(false);
  const suggestionRef = useRef<LinkedInAssistiveSuggestion | null>(null);
  const initialContentLengthRef = useRef<number>(0);
  const mountedRef = useRef(true);

  const resetState = useCallback(() => {
    setSuggestion(null);
    setAllSuggestions([]);
    setSuggestionIndex(0);
    setIsGenerating(false);
    setError(null);
    setShowContinuePrompt(false);
    hasShownFirstRef.current = false;
    initialContentLengthRef.current = 0;
    lastGeneratedAtRef.current = 0;
    ctaCooldownUntilRef.current = null;
    isGeneratingRef.current = false;
    suggestionRef.current = null;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (enablePromptTimerRef.current) clearTimeout(enablePromptTimerRef.current);
    if (ctaDebounceRef.current) clearTimeout(ctaDebounceRef.current);
  }, []);

  const generateSuggestion = useCallback(
    async (currentText: string, cursorPosition?: number) => {
      if (currentText.length < 20 || isGeneratingRef.current) return;

      isGeneratingRef.current = true;
      setIsGenerating(true);
      setError(null);
      setShowContinuePrompt(false);

      try {
        const response = await linkedInAssistiveWritingApi.getSuggestion(
          currentText,
          cursorPosition,
        );

        if (!mountedRef.current) return;

        if (!response.success || !response.suggestions.length) {
          setSuggestion(null);
          setAllSuggestions([]);
          if (response.message) {
            setError(response.message);
          } else {
            setShowContinuePrompt(true);
          }
          return;
        }

        setAllSuggestions(response.suggestions);
        setSuggestionIndex(0);
        setSuggestion(response.suggestions[0]);
        hasShownFirstRef.current = true;
        lastGeneratedAtRef.current = Date.now();
      } catch (err) {
        if (!mountedRef.current) return;
        const userError = mapAssistiveWritingError(err);
        setError(userError);
        setSuggestion(null);
        setAllSuggestions([]);
        hasShownFirstRef.current = true;
        setShowContinuePrompt(true);

        const msg = err instanceof Error ? err.message : String(err);
        const match = msg.match(/"retryDelay"\s*:\s*"(\d+)s"/);
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          const retryMs = match ? parseInt(match[1], 10) * 1000 : 40000;
          apiCooldownUntilRef.current = Date.now() + retryMs;
        }
        ctaCooldownUntilRef.current = Date.now() + CTA_DISMISS_COOLDOWN_MS;
      } finally {
        if (mountedRef.current) {
          setIsGenerating(false);
          isGeneratingRef.current = false;
        }
      }
    },
    [],
  );

  const scheduleFirstSuggestion = useCallback(
    (currentText: string, cursorPosition?: number) => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        if (apiCooldownUntilRef.current && Date.now() < apiCooldownUntilRef.current) {
          return;
        }

        const now = Date.now();
        const sinceLast = now - lastGeneratedAtRef.current;
        const baseline = initialContentLengthRef.current;
        const userAddedChars = currentText.length - baseline;

        if (
          !hasShownFirstRef.current &&
          currentText.length >= MIN_TOTAL_CHARS_FIRST &&
          userAddedChars >= MIN_USER_ADDED_CHARS_FIRST &&
          !isGeneratingRef.current
        ) {
          void generateSuggestion(currentText, cursorPosition);
          return;
        }

        if (
          !hasShownFirstRef.current &&
          currentText.length >= MIN_TOTAL_CHARS_FIRST &&
          userAddedChars < MIN_USER_ADDED_CHARS_FIRST &&
          !isGeneratingRef.current
        ) {
          setShowContinuePrompt(true);
          return;
        }

        if (
          hasShownFirstRef.current &&
          currentText.length >= MIN_TOTAL_CHARS_CONTINUE &&
          userAddedChars >= MIN_USER_ADDED_CHARS_CONTINUE &&
          sinceLast >= CONTINUE_COOLDOWN_MS &&
          !isGeneratingRef.current &&
          !suggestionRef.current
        ) {
          if (ctaCooldownUntilRef.current && Date.now() < ctaCooldownUntilRef.current) {
            return;
          }

          setShowContinuePrompt(false);
          if (ctaDebounceRef.current) clearTimeout(ctaDebounceRef.current);
          ctaDebounceRef.current = setTimeout(() => {
            setShowContinuePrompt(true);
            setSuggestion(null);
          }, 1000);
        }
      }, TYPING_DEBOUNCE_MS);
    },
    [generateSuggestion],
  );

  const handleTypingChange = useCallback(
    (newText: string, cursorPosition?: number) => {
      if (!enabled) return;
      scheduleFirstSuggestion(newText, cursorPosition);
    },
    [enabled, scheduleFirstSuggestion],
  );

  const handleAcceptSuggestion = useCallback(() => {
    if (!suggestion) return;

    const textarea = getTextarea();
    const currentContent = textarea?.value ?? draft;
    const caretIndex = textarea?.selectionStart ?? currentContent.length;
    const beforeCursor = currentContent.slice(0, caretIndex);
    const afterCursor = currentContent.slice(caretIndex);
    const insertion = ` ${suggestion.text} `;
    const newCaretIndex = caretIndex + insertion.length;

    if (onInsertWithPreview) {
      onInsertWithPreview(suggestion.text, caretIndex);
    } else {
      onDraftChange(beforeCursor + insertion + afterCursor);
      requestAnimationFrame(() => {
        const el = getTextarea();
        if (el) {
          el.focus();
          el.setSelectionRange(newCaretIndex, newCaretIndex);
        }
      });
    }

    setSuggestion(null);
    setAllSuggestions([]);
    setSuggestionIndex(0);
    setShowContinuePrompt(false);
  }, [suggestion, draft, getTextarea, onDraftChange, onInsertWithPreview]);

  const handleRejectSuggestion = useCallback(() => {
    setSuggestion(null);
    setAllSuggestions([]);
    setSuggestionIndex(0);
    ctaCooldownUntilRef.current = Date.now() + CTA_DISMISS_COOLDOWN_MS;
  }, []);

  const handleNextSuggestion = useCallback(() => {
    if (allSuggestions.length === 0 || suggestionIndex >= allSuggestions.length - 1) {
      return;
    }
    const nextIndex = suggestionIndex + 1;
    setSuggestionIndex(nextIndex);
    setSuggestion(allSuggestions[nextIndex]);
  }, [allSuggestions, suggestionIndex]);

  const handleContinueWriting = useCallback(async () => {
    const textarea = getTextarea();
    const currentContent = textarea?.value ?? draft;
    const cursorPos = textarea?.selectionStart ?? currentContent.length;

    setShowContinuePrompt(false);
    setError(null);
    ctaCooldownUntilRef.current = null;

    if (currentContent.length >= MIN_TOTAL_CHARS_FIRST) {
      await generateSuggestion(currentContent, cursorPos);
    }
  }, [draft, generateSuggestion, getTextarea]);

  const dismissSuggestion = useCallback(() => {
    setSuggestion(null);
    setError(null);
    setShowContinuePrompt(false);
    ctaCooldownUntilRef.current = Date.now() + CTA_DISMISS_COOLDOWN_MS;
  }, []);

  useEffect(() => {
    suggestionRef.current = suggestion;
  }, [suggestion]);

  useEffect(() => {
    if (!enabled) {
      resetState();
      return;
    }

    initialContentLengthRef.current = draft.length;
    setError(null);
    setSuggestion(null);
    setShowContinuePrompt(false);
    hasShownFirstRef.current = false;

    if (draft.length >= MIN_TOTAL_CHARS_FIRST) {
      enablePromptTimerRef.current = setTimeout(() => {
        if (!hasShownFirstRef.current && !isGeneratingRef.current && !suggestionRef.current) {
          setShowContinuePrompt(true);
        }
      }, TYPING_DEBOUNCE_MS);
    }

    return () => {
      if (enablePromptTimerRef.current) clearTimeout(enablePromptTimerRef.current);
    };
  }, [enabled, resetState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (enablePromptTimerRef.current) clearTimeout(enablePromptTimerRef.current);
      if (ctaDebounceRef.current) clearTimeout(ctaDebounceRef.current);
    };
  }, []);

  return {
    suggestion,
    allSuggestions,
    suggestionIndex,
    isGenerating,
    error,
    showContinuePrompt,
    handleTypingChange,
    handleAcceptSuggestion,
    handleRejectSuggestion,
    handleNextSuggestion,
    handleContinueWriting,
    dismissSuggestion,
  };
}
