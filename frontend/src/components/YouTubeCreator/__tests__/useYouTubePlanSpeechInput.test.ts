/**
 * Web Speech dictation for Plan Your Video idea field.
 */
import { renderHook, act } from "@testing-library/react";
import { useYouTubePlanSpeechInput } from "../hooks/useYouTubePlanSpeechInput";

type RecHandler = (event: { error?: string; results?: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void;

function installSpeechRecognition() {
  const instances: Array<{
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: RecHandler | null;
    onerror: RecHandler | null;
    onend: (() => void) | null;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }> = [];

  class FakeSpeechRecognition {
    lang = "";
    continuous = false;
    interimResults = false;
    onresult: RecHandler | null = null;
    onerror: RecHandler | null = null;
    onend: (() => void) | null = null;
    start = vi.fn();
    stop = vi.fn(function (this: FakeSpeechRecognition) {
      this.onend?.();
    });

    constructor() {
      instances.push(this);
    }
  }

  Object.defineProperty(window, "SpeechRecognition", {
    configurable: true,
    writable: true,
    value: FakeSpeechRecognition,
  });
  Object.defineProperty(window, "webkitSpeechRecognition", {
    configurable: true,
    writable: true,
    value: FakeSpeechRecognition,
  });
  return instances;
}

describe("useYouTubePlanSpeechInput", () => {
  afterEach(() => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  });

  it("is unsupported when SpeechRecognition is missing", () => {
    const { result } = renderHook(() => useYouTubePlanSpeechInput("en"));
    expect(result.current.isSupported).toBe(false);
  });

  it("appends a final transcript to the current idea", () => {
    const instances = installSpeechRecognition();
    const onAppend = vi.fn();
    const { result } = renderHook(() => useYouTubePlanSpeechInput("hi"));
    expect(result.current.isSupported).toBe(true);

    act(() => {
      result.current.startListening("Budget travel", onAppend);
    });
    expect(instances[0].lang).toBe("hi-IN");
    act(() => {
      instances[0].onresult?.({
        results: Object.assign([{ 0: { transcript: " packing for Tokyo" }, isFinal: true, length: 1 }], {
          length: 1,
        }),
      });
    });
    expect(onAppend).toHaveBeenCalledWith("Budget travel packing for Tokyo");
  });

  it("sets an error when the microphone is denied", () => {
    const instances = installSpeechRecognition();
    const { result } = renderHook(() => useYouTubePlanSpeechInput("en"));
    act(() => {
      result.current.startListening("", vi.fn());
    });
    act(() => {
      instances[0].onerror?.({ error: "not-allowed" });
    });
    expect(result.current.error).toMatch(/denied/i);
  });
});
