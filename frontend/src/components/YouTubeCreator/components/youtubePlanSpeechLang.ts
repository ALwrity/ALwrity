/**
 * Map Plan Your Video language codes to Web Speech BCP-47 tags.
 */

const SPEECH_LANG: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-BR",
  it: "it-IT",
  hi: "hi-IN",
  ar: "ar-SA",
  ru: "ru-RU",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "zh-CN",
  vi: "vi-VN",
  id: "id-ID",
  tr: "tr-TR",
  nl: "nl-NL",
  pl: "pl-PL",
  th: "th-TH",
};

export function youtubePlanSpeechLang(language: string | undefined | null): string {
  const code = (language || "").trim().toLowerCase().split("-")[0];
  return SPEECH_LANG[code] || "en-US";
}
