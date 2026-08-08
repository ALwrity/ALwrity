/** Quick Create / Performance Pulse create modes and payloads. */
export type PerformancePulseCreateMode = "repurpose" | "write_more";

export interface PerformancePulseCreatePayload {
  topic: string;
  key_points: string;
  reference_context: string;
  reference_mode: PerformancePulseCreateMode;
}

/** @deprecated Use PerformancePulseCreateMode */
export type PostPulseCreateMode = PerformancePulseCreateMode;

/** @deprecated Use PerformancePulseCreatePayload */
export type PostPulseCreatePayload = PerformancePulseCreatePayload;
