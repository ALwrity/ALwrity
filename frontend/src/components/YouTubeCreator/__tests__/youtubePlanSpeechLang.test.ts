/**
 * Plan idea field speech language mapping.
 */
import { youtubePlanSpeechLang } from "../components/youtubePlanSpeechLang";

describe("youtubePlanSpeechLang", () => {
  it("maps Plan language codes to BCP-47 tags", () => {
    expect(youtubePlanSpeechLang("en")).toBe("en-US");
    expect(youtubePlanSpeechLang("hi")).toBe("hi-IN");
    expect(youtubePlanSpeechLang("ja")).toBe("ja-JP");
    expect(youtubePlanSpeechLang("zh")).toBe("zh-CN");
  });

  it("falls back to en-US for unknown codes", () => {
    expect(youtubePlanSpeechLang("xx")).toBe("en-US");
    expect(youtubePlanSpeechLang("")).toBe("en-US");
  });
});
