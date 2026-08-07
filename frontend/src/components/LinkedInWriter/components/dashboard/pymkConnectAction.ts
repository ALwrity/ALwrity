import type { PymkSuggestionItem } from "../../../../services/linkedInPymkApi";

export type PymkConnectVariant = "connect" | "pending" | "connected";

export interface PymkConnectAction {
  label: string;
  variant: PymkConnectVariant;
  disabled: boolean;
  href?: string;
  title: string;
}

/**
 * Opens the member's LinkedIn profile where the user can send a connection request.
 * In-app Unipile connect API is not wired yet — profile deep-link is the production-safe path.
 */
export function resolvePymkConnectAction(
  person: PymkSuggestionItem,
): PymkConnectAction {
  const state = person.connection_state?.toLowerCase() ?? "";

  if (state === "connected") {
    return {
      label: "Connected",
      variant: "connected",
      disabled: true,
      href: person.profile_url,
      title: "You are already connected on LinkedIn",
    };
  }

  if (state === "invitation_pending") {
    return {
      label: "Pending",
      variant: "pending",
      disabled: true,
      href: person.profile_url,
      title: "Connection invitation already sent — view profile on LinkedIn",
    };
  }

  return {
    label: "Connect on LinkedIn",
    variant: "connect",
    disabled: !person.profile_url,
    href: person.profile_url,
    title: "Open this profile on LinkedIn to send a connection request",
  };
}
