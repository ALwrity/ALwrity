import { useState, useEffect } from "react";

interface Recommendation {
  id: string;
  text: string;
  category: string;
  priority: "high" | "medium" | "low";
}

export const useRecommendations = () => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);

  useEffect(() => {
    const handleRecommendationsUpdate = (event: CustomEvent) => {
      const { recommendations: newRecommendations } = event.detail || {};
      if (newRecommendations && Array.isArray(newRecommendations)) {
        // Convert string recommendations to structured format
        const structuredRecommendations: Recommendation[] =
          newRecommendations.map((rec, index) => ({
            id: `rec-${index}`,
            text: rec,
            category: "content-improvement",
            priority: "medium" as const,
          }));

        setRecommendations(structuredRecommendations);
        setShowRecommendations(true);
      }
    };

    window.addEventListener(
      "linkedinwriter:recommendationsUpdate",
      handleRecommendationsUpdate as EventListener,
    );

    return () => {
      window.removeEventListener(
        "linkedinwriter:recommendationsUpdate",
        handleRecommendationsUpdate as EventListener,
      );
    };
  }, []);

  const handleRecommendationSelect = (recommendation: Recommendation) => {
    console.log("Selected recommendation:", recommendation);

    // Here you can implement specific actions for each recommendation
    // For now, we'll just log it and could trigger specific improvement actions

    // Example: Trigger specific improvement actions based on recommendation
    if (recommendation.text.toLowerCase().includes("factual accuracy")) {
      // Could trigger factual accuracy improvement workflow
      console.log("Triggering factual accuracy improvement workflow");
    } else if (
      recommendation.text.toLowerCase().includes("professional tone")
    ) {
      // Could trigger tone improvement workflow
      console.log("Triggering professional tone improvement workflow");
    } else if (recommendation.text.toLowerCase().includes("citation")) {
      // Could trigger citation improvement workflow
      console.log("Triggering citation improvement workflow");
    }

    // You could also dispatch events to trigger specific CopilotKit actions
    window.dispatchEvent(
      new CustomEvent("linkedinwriter:improvementRequested", {
        detail: { recommendation, action: "improve" },
      }),
    );
  };

  const hideRecommendations = () => {
    setShowRecommendations(false);
    setRecommendations([]);
  };

  return {
    recommendations,
    showRecommendations,
    handleRecommendationSelect,
    hideRecommendations,
  };
};
