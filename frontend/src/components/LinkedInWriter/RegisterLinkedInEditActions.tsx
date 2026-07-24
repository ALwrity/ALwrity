import React from "react";
import { showToastNotification } from "../../utils/toastNotifications";
import { linkedInWriterApi } from "../../services/linkedInWriterApi";
import { useCopilotActionTyped } from "../../hooks/useCopilotActionTyped";

function extractHashtags(text: string): string[] {
  return text.match(/#[A-Za-z0-9_]+/g) || [];
}

function stripHashtags(text: string): string {
  return text.replace(/#[A-Za-z0-9_]+\s*/g, "").trim();
}

const RegisterLinkedInEditActions: React.FC = () => {
  // ── 1. Professionalize ────────────────────────────────────────────────
  useCopilotActionTyped({
    name: "professionalizeLinkedInContent",
    description:
      "Make LinkedIn content more professional, polished, and industry-appropriate using AI",
    parameters: [
      { name: "content", type: "string", required: false },
      { name: "industry", type: "string", required: false },
      { name: "target_audience", type: "string", required: false },
    ],
    handler: async (args: any) => {
      const content = args?.content || "";
      if (!content.trim())
        return { success: false, message: "No content to professionalize" };

      const res = await linkedInWriterApi.editContent({
        content,
        edit_type: "professionalize",
        industry: args?.industry,
        target_audience: args?.target_audience,
      });

      if (res.success && res.content) {
        window.dispatchEvent(
          new CustomEvent("linkedinwriter:applyEdit", {
            detail: { target: res.content },
          }),
        );
        return {
          success: true,
          content: res.content,
          message: "Content professionalized with AI.",
        };
      }
      return {
        success: false,
        message: res.error || "Failed to professionalize content",
      };
    },
  });

  // ── 2. Optimize Engagement ────────────────────────────────────────────
  useCopilotActionTyped({
    name: "optimizeLinkedInEngagement",
    description:
      "Optimize LinkedIn content for better engagement — strengthen hook, improve readability, encourage interaction",
    parameters: [
      { name: "content", type: "string", required: false },
      { name: "industry", type: "string", required: false },
    ],
    handler: async (args: any) => {
      const content = args?.content || "";
      if (!content.trim())
        return { success: false, message: "No content to optimize" };

      const res = await linkedInWriterApi.editContent({
        content,
        edit_type: "optimize_engagement",
        industry: args?.industry,
      });

      if (res.success && res.content) {
        window.dispatchEvent(
          new CustomEvent("linkedinwriter:applyEdit", {
            detail: { target: res.content },
          }),
        );
        return {
          success: true,
          content: res.content,
          message: "Content optimized for engagement.",
        };
      }
      return {
        success: false,
        message: res.error || "Failed to optimize content",
      };
    },
  });

  // ── 3. Add Hashtags (AI-powered) ──────────────────────────────────────
  useCopilotActionTyped({
    name: "addLinkedInHashtags",
    description:
      "Generate relevant, industry-specific hashtags for LinkedIn content using AI",
    parameters: [
      { name: "content", type: "string", required: false },
      { name: "industry", type: "string", required: false },
    ],
    handler: async (args: any) => {
      const content = args?.content || "";
      if (!content.trim())
        return { success: false, message: "No content to add hashtags to" };

      const existingHashtags = extractHashtags(content);
      if (existingHashtags.length >= 5) {
        showToastNotification(
          "Content already has plenty of hashtags.",
          "info",
        );
        return { success: false, message: "Content already has 5+ hashtags" };
      }

      const res = await linkedInWriterApi.editContent({
        content: stripHashtags(content),
        edit_type: "add_hashtags",
        industry: args?.industry,
      });

      if (res.success && res.content) {
        window.dispatchEvent(
          new CustomEvent("linkedinwriter:applyEdit", {
            detail: { target: res.content },
          }),
        );
        const newHashtags = extractHashtags(res.content);
        return { success: true, content: res.content, hashtags: newHashtags };
      }
      return {
        success: false,
        message: res.error || "Failed to generate hashtags",
      };
    },
  });

  // ── 4. Adjust Tone ────────────────────────────────────────────────────
  useCopilotActionTyped({
    name: "adjustLinkedInTone",
    description:
      "Rewrite LinkedIn content in a different tone — professional, conversational, authoritative, educational, or friendly",
    parameters: [
      { name: "content", type: "string", required: false },
      {
        name: "target_tone",
        type: "string",
        required: false,
        description:
          "professional, conversational, authoritative, educational, friendly",
      },
    ],
    handler: async (args: any) => {
      const content = args?.content || "";
      const targetTone = args?.target_tone || "professional";
      if (!content.trim())
        return { success: false, message: "No content to adjust tone for" };

      const res = await linkedInWriterApi.editContent({
        content,
        edit_type: "adjust_tone",
        tone: targetTone,
      });

      if (res.success && res.content) {
        window.dispatchEvent(
          new CustomEvent("linkedinwriter:applyEdit", {
            detail: { target: res.content },
          }),
        );
        return {
          success: true,
          content: res.content,
          message: `Tone adjusted to ${targetTone}.`,
        };
      }
      return { success: false, message: res.error || "Failed to adjust tone" };
    },
  });

  // ── 5. Expand Content ─────────────────────────────────────────────────
  useCopilotActionTyped({
    name: "expandLinkedInContent",
    description:
      "Expand LinkedIn content with more depth, examples, data points, and actionable insights using AI",
    parameters: [
      { name: "content", type: "string", required: false },
      { name: "industry", type: "string", required: false },
      { name: "target_audience", type: "string", required: false },
    ],
    handler: async (args: any) => {
      const content = args?.content || "";
      if (!content.trim())
        return { success: false, message: "No content to expand" };

      const res = await linkedInWriterApi.editContent({
        content,
        edit_type: "expand",
        industry: args?.industry,
        target_audience: args?.target_audience,
      });

      if (res.success && res.content) {
        window.dispatchEvent(
          new CustomEvent("linkedinwriter:applyEdit", {
            detail: { target: res.content },
          }),
        );
        return {
          success: true,
          content: res.content,
          message: "Content expanded with AI.",
        };
      }
      return {
        success: false,
        message: res.error || "Failed to expand content",
      };
    },
  });

  // ── 6. Condense Content ───────────────────────────────────────────────
  useCopilotActionTyped({
    name: "condenseLinkedInContent",
    description:
      "Condense LinkedIn content to be more concise and impactful using AI — preserves key messages",
    parameters: [
      { name: "content", type: "string", required: false },
      {
        name: "target_length",
        type: "string",
        required: false,
        description: "short, medium, long",
      },
    ],
    handler: async (args: any) => {
      const content = args?.content || "";
      const targetLength = args?.target_length || "medium";
      if (!content.trim())
        return { success: false, message: "No content to condense" };

      const lengthMap: Record<string, string> = {
        short: "very concise (1-2 sentences)",
        medium: "half the original length",
        long: "slightly shortened",
      };

      const res = await linkedInWriterApi.editContent({
        content,
        edit_type: "condense",
        parameters: {
          target_length: lengthMap[targetLength] || lengthMap.medium,
        },
      });

      if (res.success && res.content) {
        window.dispatchEvent(
          new CustomEvent("linkedinwriter:applyEdit", {
            detail: { target: res.content },
          }),
        );
        return {
          success: true,
          content: res.content,
          message: "Content condensed with AI.",
        };
      }
      return {
        success: false,
        message: res.error || "Failed to condense content",
      };
    },
  });

  // ── 7. Add Call to Action ─────────────────────────────────────────────
  useCopilotActionTyped({
    name: "addLinkedInCallToAction",
    description:
      "Add a contextual, engaging call-to-action to LinkedIn content using AI",
    parameters: [
      { name: "content", type: "string", required: false },
      {
        name: "cta_type",
        type: "string",
        required: false,
        description: "engagement, networking, learning, collaboration",
      },
    ],
    handler: async (args: any) => {
      const content = args?.content || "";
      if (!content.trim())
        return { success: false, message: "No content to add CTA to" };

      if (
        /\b(call now|sign up|join|try|learn more|comment|share|connect|message|dm|reach out)\b/i.test(
          content,
        )
      ) {
        showToastNotification(
          "Content already contains a call to action.",
          "info",
        );
        return { success: false, message: "Content already has a CTA" };
      }

      const res = await linkedInWriterApi.editContent({
        content,
        edit_type: "add_cta",
        parameters: { cta_type: args?.cta_type || "engagement" },
      });

      if (res.success && res.content) {
        window.dispatchEvent(
          new CustomEvent("linkedinwriter:applyEdit", {
            detail: { target: res.content },
          }),
        );
        return {
          success: true,
          content: res.content,
          message: "CTA added with AI.",
        };
      }
      return { success: false, message: res.error || "Failed to add CTA" };
    },
  });

  return null;
};

export default RegisterLinkedInEditActions;
