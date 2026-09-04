/**
 * User-safe IFrame Player onError codes (no Google bodies).
 * https://developers.google.com/youtube/iframe_api_reference#Events
 */

export function userSafeYouTubeIframeError(code: number): string {
  if (code === 100) {
    return "This video is unavailable.";
  }
  if (code === 101 || code === 150) {
    return "This video cannot be played here.";
  }
  return "This video could not be played here.";
}
