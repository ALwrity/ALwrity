/**
 * Shared Performance Pulse tile config for the Remarket wedge grid.
 */

export const PERFORMANCE_PULSE_TILE = {
  title: "Performance Pulse",
  icon: "📊",
  accent: "#8b5cf6",
  disabledReason:
    "Connect your LinkedIn account to view post engagement metrics",
  descriptionConnected:
    "Real engagement metrics — repurpose winners, boost underperformers",
  descriptionDisconnected:
    "Connect LinkedIn to view your post engagement metrics",
} as const;

export function getPerformancePulseTileDescription(connected: boolean): string {
  return connected
    ? PERFORMANCE_PULSE_TILE.descriptionConnected
    : PERFORMANCE_PULSE_TILE.descriptionDisconnected;
}
