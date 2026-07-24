/** Opens the same connect gate as Optimise Profile (WelcomeMessage listener). */
export function requestLinkedInConnectGate(): void {
  window.dispatchEvent(new CustomEvent("linkedinwriter:openOptimiseProfile"));
}
