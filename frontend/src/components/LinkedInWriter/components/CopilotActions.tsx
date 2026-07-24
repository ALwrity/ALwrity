import React, { useMemo } from "react";
import { useCopilotContext } from "@copilotkit/react-core";
import { usePlatformPersonaContext } from "../../shared/PersonaContext/PlatformPersonaProvider";
import { showToastNotification } from "../../../utils/toastNotifications";
import { useCopilotActionTyped } from "../../../hooks/useCopilotActionTyped";
import "../../../types/linkedinWriterEvents";

// Optional debug flag: set to true to enable verbose logs locally
const DEBUG_LINKEDIN = false;

interface CopilotActionsProps {
  draft: string;
  context: string;
  userPreferences: any;
  justGeneratedContent: boolean;
  handleContextChange: (value: string) => void;
  setDraft: (draft: string) => void;
}

// Note: This is implemented as a custom hook.
// It returns the getIntelligentSuggestions function for use by the caller.
export const useCopilotActions = ({
  draft,
  context,
  userPreferences,
  justGeneratedContent,
  handleContextChange,
  setDraft,
}: CopilotActionsProps) => {
  const { corePersona, platformPersona } = usePlatformPersonaContext();
  const copilotContext = useCopilotContext();

  // Provide persona context to Copilot
  React.useEffect(() => {
    if (corePersona || platformPersona) {
      // Logic to update copilot context with persona data
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corePersona, platformPersona]);

  // Provide enhanced context to Copilot based on conversation history
  React.useEffect(() => {
    if (copilotContext) {
      // Logic using copilotContext
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copilotContext]);

  // Listen for copilot seed events to open sidebar with prompt
  React.useEffect(() => {
    const handler = (ev: any) => {
      try {
        const { prompt } = ev.detail || {};
        if (!prompt) return;

        // First, open the copilot sidebar
        const copilotButton =
          document.querySelector(".copilotkit-open-button") ||
          document.querySelector("[data-copilot-open]") ||
          document.querySelector('button[aria-label*="Open"]') ||
          document.querySelector(".alwrity-copilot-sidebar button") ||
          document.querySelector('[data-testid="copilot-open-button"]');

        if (copilotButton) {
          (copilotButton as HTMLElement).click();

          // Try context-based approach first (if available)
          if (copilotContext && typeof copilotContext === "object") {
            try {
              // Check if context has any message sending capabilities
              if (
                "sendMessage" in copilotContext &&
                typeof (copilotContext as Record<string, unknown>)
                  .sendMessage === "function"
              ) {
                setTimeout(() => {
                  (
                    copilotContext as { sendMessage: (msg: string) => void }
                  ).sendMessage(prompt);
                  console.log("Message sent via context");
                  return;
                }, 500);
              }
            } catch (e) {
              console.log(
                "Context-based approach failed, falling back to DOM manipulation",
              );
            }
          }

          // Alternative: Try to trigger the generateFromPrompt action directly
          setTimeout(() => {
            // Try to find and trigger the generateFromPrompt action
            const actionButton =
              document.querySelector('[data-action="generateFromPrompt"]') ||
              document.querySelector('button[title*="generateFromPrompt"]');
            if (actionButton) {
              // Set the prompt in a temporary storage for the action to pick up
              window.tempPromptForGeneration = prompt;
              (actionButton as HTMLElement).click();
              console.log("Triggered generateFromPrompt action with:", prompt);
              return;
            }
          }, 200);

          // Fallback: Wait a bit for the sidebar to open, then set the input value
          setTimeout(() => {
            // Try multiple selectors for the chat input
            const chatInput =
              document.querySelector(".copilotkit-chat-input") ||
              document.querySelector('textarea[placeholder*="message"]') ||
              document.querySelector('input[placeholder*="message"]') ||
              document.querySelector(".copilot-chat-input") ||
              document.querySelector('[data-testid="chat-input"]') ||
              document.querySelector('textarea[data-testid="chat-input"]') ||
              document.querySelector(".copilotkit-chat-input textarea") ||
              document.querySelector(".copilotkit-chat-input input") ||
              document.querySelector("textarea[data-copilot-input]") ||
              document.querySelector("input[data-copilot-input]");

            if (chatInput) {
              const inputElement = chatInput as
                HTMLInputElement | HTMLTextAreaElement;

              // Check if input is disabled or read-only
              if (inputElement.disabled || inputElement.readOnly) {
                console.warn(
                  "Input is disabled or read-only, attempting to enable it",
                );
                inputElement.disabled = false;
                inputElement.readOnly = false;
                inputElement.removeAttribute("disabled");
                inputElement.removeAttribute("readonly");
              }

              // Clear any existing value first
              inputElement.value = "";

              // Set the new value
              inputElement.value = prompt;

              // Focus the input
              inputElement.focus();

              // Trigger multiple events to ensure React state updates
              const inputEvent = new Event("input", {
                bubbles: true,
                cancelable: true,
              });
              const changeEvent = new Event("change", {
                bubbles: true,
                cancelable: true,
              });
              const keyupEvent = new Event("keyup", {
                bubbles: true,
                cancelable: true,
              });

              // Set the target property for React synthetic events
              Object.defineProperty(inputEvent, "target", {
                value: inputElement,
                enumerable: true,
              });
              Object.defineProperty(changeEvent, "target", {
                value: inputElement,
                enumerable: true,
              });
              Object.defineProperty(keyupEvent, "target", {
                value: inputElement,
                enumerable: true,
              });

              // Dispatch events in sequence
              inputElement.dispatchEvent(inputEvent);
              inputElement.dispatchEvent(changeEvent);
              inputElement.dispatchEvent(keyupEvent);

              // Try to trigger a React synthetic event with more properties
              const syntheticEvent = new Event("input", {
                bubbles: true,
                cancelable: true,
              });
              Object.defineProperty(syntheticEvent, "target", {
                value: inputElement,
                enumerable: true,
              });
              Object.defineProperty(syntheticEvent, "currentTarget", {
                value: inputElement,
                enumerable: true,
              });
              Object.defineProperty(syntheticEvent, "nativeEvent", {
                value: syntheticEvent,
                enumerable: true,
              });
              inputElement.dispatchEvent(syntheticEvent);

              // Also try to trigger a focus event to ensure the input is active
              const focusEvent = new Event("focus", {
                bubbles: true,
                cancelable: true,
              });
              inputElement.dispatchEvent(focusEvent);

              // Try to find and enable the send button if it exists
              setTimeout(() => {
                const sendButton =
                  document.querySelector('button[type="submit"]') ||
                  document.querySelector("button[data-copilot-send]") ||
                  document.querySelector(".copilotkit-send-button") ||
                  document.querySelector('button[aria-label*="Send"]') ||
                  document.querySelector('button[title*="Send"]');

                if (sendButton) {
                  // Remove disabled attribute if it exists
                  (sendButton as HTMLButtonElement).disabled = false;
                  (sendButton as HTMLButtonElement).removeAttribute("disabled");
                  console.log("Send button enabled");

                  // Try to automatically send the message after a short delay
                  setTimeout(() => {
                    if (!(sendButton as HTMLButtonElement).disabled) {
                      (sendButton as HTMLButtonElement).click();
                      console.log("Message sent automatically");
                    }
                  }, 500);

                  // Alternative: Try to simulate Enter key press
                  setTimeout(() => {
                    const enterEvent = new KeyboardEvent("keydown", {
                      key: "Enter",
                      code: "Enter",
                      keyCode: 13,
                      which: 13,
                      bubbles: true,
                      cancelable: true,
                    });
                    inputElement.dispatchEvent(enterEvent);

                    const enterUpEvent = new KeyboardEvent("keyup", {
                      key: "Enter",
                      code: "Enter",
                      keyCode: 13,
                      which: 13,
                      bubbles: true,
                      cancelable: true,
                    });
                    inputElement.dispatchEvent(enterUpEvent);
                    console.log("Enter key simulated");
                  }, 600);
                }
              }, 100);

              console.log("Copilot sidebar opened with prompt:", prompt);
              console.log("Input element details:", {
                value: inputElement.value,
                disabled: inputElement.disabled,
                readOnly: inputElement.readOnly,
                className: inputElement.className,
                id: inputElement.id,
              });
            } else {
              console.warn(
                "Could not find copilot chat input to prefill. Available elements:",
                Array.from(document.querySelectorAll("textarea, input")).map(
                  (el) => ({
                    tag: el.tagName,
                    className: el.className,
                    placeholder: el.getAttribute("placeholder"),
                    id: el.id,
                    "data-copilot-input": el.getAttribute("data-copilot-input"),
                  }),
                ),
              );
            }
          }, 1000); // Increased timeout to ensure sidebar is fully loaded
        } else {
          console.warn(
            "Could not find copilot sidebar button to open. Available buttons:",
            Array.from(document.querySelectorAll("button")).map((btn) => ({
              className: btn.className,
              text: btn.textContent?.trim(),
              "aria-label": btn.getAttribute("aria-label"),
            })),
          );
        }
      } catch (e) {
        console.error("Error handling copilot seed event:", e);
      }
    };

    window.addEventListener("linkedinwriter:copilotSeedFromPrompt", handler);
    return () =>
      window.removeEventListener(
        "linkedinwriter:copilotSeedFromPrompt",
        handler,
      );
  }, []);

  // Allow external prompts to trigger content generation
  useCopilotActionTyped({
    name: "generateFromPrompt",
    description: "Generate LinkedIn content from a specific prompt or idea",
    parameters: [
      {
        name: "prompt",
        type: "string",
        description: "The prompt or idea to generate content from",
        required: true,
      },
    ],
    handler: async ({ prompt }: { prompt: string }) => {
      // Check for temporary prompt from brainstorm flow
      const finalPrompt = prompt || window.tempPromptForGeneration;

      if (!finalPrompt) {
        return { success: false, message: "No prompt provided" };
      }

      // Clear the temporary prompt
      if (window.tempPromptForGeneration) {
        delete window.tempPromptForGeneration;
      }

      // Set the prompt as context and trigger generation
      handleContextChange(finalPrompt);

      // Use the existing LinkedIn post generation action
      try {
        // This will trigger the existing generateLinkedInPost action
        return {
          success: true,
          message: `Generating LinkedIn content from prompt: "${finalPrompt}"`,
          prompt: finalPrompt,
        };
      } catch (error) {
        return {
          success: false,
          message: "Failed to generate content from prompt",
        };
      }
    },
  });

  // Allow Copilot to edit the draft with specific operations
  useCopilotActionTyped({
    name: "editLinkedInDraft",
    description:
      "Apply a quick style or structural edit to the current LinkedIn draft",
    parameters: [
      {
        name: "operation",
        type: "string",
        description: "The edit operation to perform",
        required: true,
        enum: [
          "Casual",
          "Professional",
          "TightenHook",
          "AddCTA",
          "Shorten",
          "Lengthen",
          "AddEmojis",
          "AddHashtags",
          "ImproveClarity",
          "AdjustTone",
          "RewriteHook",
        ],
      },
    ],
    handler: async ({ operation }: { operation: string }) => {
      const COMING_SOON_OPS = ["ImproveClarity", "AdjustTone", "RewriteHook"];
      if (COMING_SOON_OPS.includes(operation)) {
        const labels: Record<string, string> = {
          ImproveClarity: "Improve Clarity",
          AdjustTone: "Tone Adjustment",
          RewriteHook: "Hook Rewrite",
        };
        const label = labels[operation] || operation;
        showToastNotification(
          `${label} is coming soon! This feature will use AI to enhance your content.`,
          "info",
        );
        return { success: false, message: `${label} feature coming soon` };
      }

      const currentDraft = draft || "";
      if (!currentDraft) {
        return { success: false, message: "No draft content to edit" };
      }

      let editedContent = currentDraft;

      switch (operation) {
        case "Casual":
          editedContent = currentDraft.replace(
            /\b(utilize|implement|facilitate|leverage)\b/gi,
            (match) => {
              const casual = {
                utilize: "use",
                implement: "put in place",
                facilitate: "help",
                leverage: "use",
              };
              return (
                casual[match.toLowerCase() as keyof typeof casual] || match
              );
            },
          );
          editedContent = editedContent.replace(/\./g, "! 😊");
          break;

        case "Professional":
          editedContent = currentDraft.replace(
            /\b(use|put in place|help)\b/gi,
            (match) => {
              const professional = {
                use: "utilize",
                "put in place": "implement",
                help: "facilitate",
              };
              return (
                professional[
                  match.toLowerCase() as keyof typeof professional
                ] || match
              );
            },
          );
          editedContent = editedContent.replace(/! 😊/g, ".");
          break;

        case "TightenHook":
          const lines = currentDraft.split("\n");
          if (lines.length > 0) {
            const firstLine = lines[0];
            const tightened =
              firstLine.length > 100
                ? firstLine.substring(0, 100) + "..."
                : firstLine;
            lines[0] = tightened;
            editedContent = lines.join("\n");
          }
          break;

        case "AddCTA":
          if (
            !/\b(call now|sign up|join|try|learn more|cta|comment|share|connect|message|dm|reach out)\b/i.test(
              currentDraft,
            )
          ) {
            editedContent =
              currentDraft +
              "\n\nWhat are your thoughts on this? Share your experience in the comments below!";
          }
          break;

        case "Shorten":
          if (currentDraft.length > 200) {
            editedContent = currentDraft.substring(0, 200) + "...";
          }
          break;

        case "Lengthen":
          if (currentDraft.length < 500) {
            editedContent =
              currentDraft +
              "\n\nThis approach has shown remarkable results in our industry. The key is to maintain consistency while adapting to changing market conditions.";
          }
          break;

        case "AddEmojis": {
          const selectEmojis = (text: string): string[] => {
            const lower = text.toLowerCase();
            let category = "general";
            if (/achiev|success|milestone|goal|win/i.test(lower))
              category = "achievement";
            else if (/strateg|plan|growth|metric/i.test(lower))
              category = "strategy";
            else if (/collabor|team|partner|connect|network/i.test(lower))
              category = "collaboration";
            else if (/learn|skill|develop|train|educat/i.test(lower))
              category = "learning";
            else if (/innovat|new|future|transform|ai|tech/i.test(lower))
              category = "innovation";
            const emojiSets: Record<string, string[]> = {
              achievement: ["🏆", "🎯", "⭐", "🚀", "💪"],
              strategy: ["📈", "📊", "🧭", "💡", "🔑"],
              collaboration: ["🤝", "👥", "💬", "🌐", "🤝"],
              learning: ["📚", "🎓", "🧠", "💡", "📖"],
              innovation: ["💡", "🔬", "⚡", "🔮", "✨"],
              general: ["✅", "🎯", "💡", "📌", "🔥"],
            };
            return emojiSets[category];
          };
          const emojis = selectEmojis(currentDraft);
          const enriched = currentDraft
            .split("\n")
            .map((line: string, i: number) => {
              const trimmed = line.trim();
              if (
                !trimmed ||
                trimmed.startsWith("#") ||
                trimmed.startsWith("---") ||
                trimmed.startsWith("http")
              )
                return line;
              return `${emojis[i % emojis.length]} ${line}`;
            })
            .join("\n");
          editedContent = enriched;
          break;
        }

        case "AddHashtags": {
          const INDUSTRY_TAGS: Record<string, string[]> = {
            technology: [
              "#TechLeadership",
              "#DigitalTransformation",
              "#Innovation",
              "#FutureOfWork",
              "#AI",
            ],
            marketing: [
              "#MarketingStrategy",
              "#DigitalMarketing",
              "#ContentMarketing",
              "#GrowthMarketing",
              "#BrandBuilding",
            ],
            default: [
              "#ProfessionalDevelopment",
              "#CareerGrowth",
              "#Leadership",
              "#IndustryInsights",
              "#Networking",
            ],
          };
          const existing: string[] =
            currentDraft.match(/#[A-Za-z0-9_]+/g) || [];
          if (existing.length >= 5) break;
          const tags = (
            INDUSTRY_TAGS[userPreferences?.industry?.toLowerCase()] ||
            INDUSTRY_TAGS.default
          )
            .filter((t: string) => !existing.includes(t))
            .slice(0, 5);
          if (tags.length > 0)
            editedContent = `${currentDraft}\n\n${tags.join(" ")}`;
          break;
        }

        default:
          return { success: false, message: "Unknown operation" };
      }

      // Use the edit action to show the diff preview
      window.dispatchEvent(
        new CustomEvent("linkedinwriter:applyEdit", {
          detail: { target: editedContent },
        }),
      );

      return {
        success: true,
        message: `Draft ${operation.toLowerCase()} applied`,
        content: editedContent,
      };
    },
  });

  // Intelligent, stage-aware suggestions (memoized to prevent infinite re-rendering)
  const getIntelligentSuggestions = useMemo(() => {
    const hasContent = draft && draft.trim().length > 0;
    const hasCTA =
      /\b(call now|sign up|join|try|learn more|cta|comment|share|connect|message|dm|reach out)\b/i.test(
        draft || "",
      );
    const hasHashtags = /#[A-Za-z0-9_]+/.test(draft || "");
    const isLong = (draft || "").length > 500;
    const hasPersona = !!(corePersona && platformPersona);

    // Debug logging for suggestions
    if (DEBUG_LINKEDIN)
      console.log("[LinkedIn Writer] Generating suggestions:", {
        hasContent,
        justGeneratedContent,
        hasPersona,
        draftLength: draft?.length || 0,
      });

    if (!hasContent) {
      // Initial suggestions for content creation
      const initialSuggestions: { title: string; message: string }[] = [];

      // Persona-aware actions first when persona data is available
      if (hasPersona) {
        initialSuggestions.push(
          {
            title: "🎭 Post (Persona-Optimized)",
            message:
              "Use tool generateLinkedInPostWithPersona to create a post optimized for your writing style and LinkedIn platform constraints.",
          },
          {
            title: "🎭 Article (Persona-Optimized)",
            message:
              "Use tool generateLinkedInArticleWithPersona to write an article with persona-aware optimization.",
          },
        );
      }

      // Standard actions
      initialSuggestions.push(
        {
          title: "📝 LinkedIn Post",
          message:
            "Use tool generateLinkedInPost to create a professional LinkedIn post for your industry.",
        },
        {
          title: "📄 Article",
          message:
            "Use tool generateLinkedInArticle to write a thought leadership article.",
        },
        {
          title: "🎠 Carousel",
          message:
            "Use tool generateLinkedInCarousel to create a multi-slide carousel presentation.",
        },
        {
          title: "🎬 Video Script",
          message:
            "Use tool generateLinkedInVideoScript to draft a video script for LinkedIn.",
        },
        {
          title: "💬 Comment Response",
          message:
            "Use tool generateLinkedInCommentResponse to craft a professional comment reply.",
        },
        {
          title: "🖼️ Generate Post Image",
          message:
            "Use tool generateLinkedInImagePrompts to create professional images for your LinkedIn content.",
        },
      );

      // Persona validation and suggestions when persona is available
      if (hasPersona) {
        initialSuggestions.push(
          {
            title: "✅ Validate Against Persona",
            message:
              "Use tool validateContentAgainstPersona to check existing content against your writing persona.",
          },
          {
            title: "🎨 Get Writing Suggestions",
            message:
              "Use tool getPersonaWritingSuggestions to receive personalized recommendations based on your persona.",
          },
        );
      }

      console.log("[LinkedIn Writer] Initial suggestions:", initialSuggestions);
      return initialSuggestions;
    } else {
      // Refinement suggestions for existing content - use direct edit actions
      const refinementSuggestions: { title: string; message: string }[] = [
        {
          title: "🙂 Make it casual",
          message: "Use tool editLinkedInDraft with operation Casual",
        },
        {
          title: "💼 Make it professional",
          message: "Use tool editLinkedInDraft with operation Professional",
        },
        {
          title: "✨ Tighten hook",
          message: "Use tool editLinkedInDraft with operation TightenHook",
        },
        {
          title: "📣 Add a CTA",
          message: "Use tool editLinkedInDraft with operation AddCTA",
        },
        {
          title: "😀 Add emojis",
          message: "Use tool editLinkedInDraft with operation AddEmojis",
        },
        {
          title: "🏷️ Add hashtags",
          message: "Use tool editLinkedInDraft with operation AddHashtags",
        },
        {
          title: "✂️ Shorten",
          message: "Use tool editLinkedInDraft with operation Shorten",
        },
        {
          title: "➕ Lengthen",
          message: "Use tool editLinkedInDraft with operation Lengthen",
        },
      ];

      // Add special suggestions when content was just generated
      if (justGeneratedContent) {
        console.log("[LinkedIn Writer] Adding post-generation suggestions");
        refinementSuggestions.unshift(
          {
            title: "🎉 Content Generated! Next Steps:",
            message:
              "Great! Your content is ready. Now let's enhance it with images and make it perfect for LinkedIn.",
          },
          {
            title: "🖼️ Generate Post Image",
            message:
              "Use tool generateLinkedInImagePrompts to create professional images for this LinkedIn post",
          },
        );
      }

      // Add contextual suggestions based on content analysis
      if (!hasCTA) {
        refinementSuggestions.push({
          title: "📣 Add CTA",
          message: "Use tool editLinkedInDraft with operation AddCTA",
        });
      }
      if (!hasHashtags) {
        refinementSuggestions.push({
          title: "🏷️ Add hashtags",
          message: "Use tool addLinkedInHashtags",
        });
      }
      if (isLong) {
        refinementSuggestions.push({
          title: "📝 Summarize intro",
          message: "Use tool editLinkedInDraft with operation Shorten",
        });
      }

      // Persona-aware refinement actions
      if (hasPersona) {
        refinementSuggestions.push(
          {
            title: "✅ Validate Against Persona",
            message:
              "Use tool validateContentAgainstPersona to check this content against your writing persona.",
          },
          {
            title: "🎨 Get Writing Suggestions",
            message:
              "Use tool getPersonaWritingSuggestions to receive personalized recommendations.",
          },
        );
      }

      // Add image generation suggestion when there's content
      if (draft && draft.trim().length > 0) {
        if (DEBUG_LINKEDIN)
          console.log("[LinkedIn Writer] Adding image generation suggestion");
        // Make image generation suggestion more prominent
        refinementSuggestions.push({
          title: "🖼️ Generate Post Image",
          message:
            "Use tool generateLinkedInImagePrompts to create professional images for this LinkedIn post",
        });

        // Add contextual image suggestions based on content type
        if (
          draft.includes("digital transformation") ||
          draft.includes("technology") ||
          draft.includes("innovation")
        ) {
          refinementSuggestions.push({
            title: "🚀 Tech-Focused Image",
            message:
              "Use tool generateLinkedInImagePrompts to create technology-themed professional images for this post",
          });
        } else if (
          draft.includes("business") ||
          draft.includes("strategy") ||
          draft.includes("growth")
        ) {
          refinementSuggestions.push({
            title: "💼 Business Image",
            message:
              "Use tool generateLinkedInImagePrompts to create business-focused professional images for this post",
          });
        }
      }

      if (DEBUG_LINKEDIN)
        console.log(
          "[LinkedIn Writer] Final suggestions:",
          refinementSuggestions,
        );
      return refinementSuggestions;
    }
  }, [draft, justGeneratedContent, corePersona, platformPersona]);

  // Return the suggestions function directly
  return getIntelligentSuggestions;
};
