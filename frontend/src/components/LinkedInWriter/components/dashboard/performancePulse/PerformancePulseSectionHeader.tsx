import React from "react";
import { colors } from "../../GrowthEngine/styles";

export const PerformancePulseSectionHeader: React.FC<{
  icon: string;
  label: string;
}> = ({ icon, label }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      margin: "14px 0 8px",
      fontSize: 12,
      fontWeight: 700,
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    }}
  >
    <span style={{ fontSize: 14 }}>{icon}</span>
    {label}
  </div>
);
