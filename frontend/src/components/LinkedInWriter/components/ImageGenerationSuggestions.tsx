import React, { useState, useEffect } from "react";
import {
  AutoAwesome as SparklesIcon,
  PhotoCamera as PhotoIcon,
  ArrowForward as ArrowRightIcon,
  CheckCircle as CheckCircleIcon,
  Warning as ExclamationTriangleIcon,
} from "@mui/icons-material";
import { useCopilotActionTyped } from "../../../hooks/useCopilotActionTyped";

interface ImageGenerationSuggestionsProps {
  contentType: "post" | "article" | "carousel" | "video_script";
  topic: string;
  industry: string;
  content: string;
  onImageGenerated?: (imageData: any) => void;
  className?: string;
}

interface ImagePrompt {
  style: string;
  prompt: string;
  description: string;
  prompt_index: number;
}

interface ImageGenerationState {
  isGenerating: boolean;
  selectedPrompt: ImagePrompt | null;
  generatedImage: any | null;
  error: string | null;
  progress: number;
}

const ImageGenerationSuggestions: React.FC<ImageGenerationSuggestionsProps> = ({
  contentType,
  topic,
  industry,
  content,
  onImageGenerated,
  className = "",
}) => {
  const [state, setState] = useState<ImageGenerationState>({
    isGenerating: false,
    selectedPrompt: null,
    generatedImage: null,
    error: null,
    progress: 0,
  });

  const [prompts, setPrompts] = useState<ImagePrompt[]>([]);
  const [showPrompts, setShowPrompts] = useState(false);

  // Register Copilot action for generating image prompts
  useCopilotActionTyped({
    name: "generate_image_prompts",
    description:
      "Generate three AI-optimized image prompts for LinkedIn content",
    parameters: [
      { name: "content_type", type: "string", required: true },
      { name: "topic", type: "string", required: true },
      { name: "industry", type: "string", required: true },
      { name: "content", type: "string", required: true },
    ],
    handler: async (args: any) => {
      try {
        // Call the actual backend API
        const response = await fetch("/api/linkedin/generate-image-prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content_type: args.content_type,
            topic: args.topic,
            industry: args.industry,
            content: args.content,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `API call failed: ${response.status} ${response.statusText}`,
          );
        }

        const prompts = await response.json();
        return { prompts };
      } catch (error) {
        console.error("Error generating image prompts:", error);
        // Fallback to predefined prompts if API fails
        const fallbackPrompts = [
          {
            style: "Professional",
            prompt: `Create a professional LinkedIn ${args.content_type} image for ${args.topic} in the ${args.industry} industry with corporate aesthetics, clean lines, and professional color palette.`,
            description: "Clean, business-appropriate visual for LinkedIn",
            prompt_index: 0,
          },
          {
            style: "Creative",
            prompt: `Generate a creative LinkedIn ${args.content_type} image for ${args.topic} with eye-catching design, vibrant colors while maintaining professional appeal, and social media engagement optimization.`,
            description: "Eye-catching, shareable design for LinkedIn",
            prompt_index: 1,
          },
          {
            style: "Industry-Specific",
            prompt: `Design a ${args.industry} industry-specific LinkedIn ${args.content_type} image for ${args.topic} with industry-relevant imagery, colors, and visual elements that appeal to business professionals.`,
            description: `Industry-tailored professional design for ${args.industry}`,
            prompt_index: 2,
          },
        ];

        return { prompts: fallbackPrompts };
      }
    },
  });

  // Register Copilot action for generating images
  useCopilotActionTyped({
    name: "generate_linkedin_image",
    description: "Generate LinkedIn-optimized image from selected prompt",
    parameters: [
      { name: "prompt", type: "string", required: true },
      {
        name: "content_context",
        type: "object",
        required: true,
        attributes: [
          { name: "topic", type: "string", required: true },
          { name: "industry", type: "string", required: true },
          { name: "content_type", type: "string", required: true },
          { name: "style", type: "string", required: true },
        ],
      },
      { name: "aspect_ratio", type: "string", required: false },
    ],
    handler: async (args: any) => {
      try {
        // Call the actual backend API
        const response = await fetch("/api/linkedin/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: args.prompt,
            content_context: args.content_context,
            aspect_ratio: args.aspect_ratio || "1:1",
          }),
        });

        if (!response.ok) {
          throw new Error(
            `API call failed: ${response.status} ${response.statusText}`,
          );
        }

        const result = await response.json();
        return result;
      } catch (error) {
        console.error("Error generating image:", error);
        throw error;
      }
    },
  });

  // Handle prompt generation
  const handleGeneratePrompts = async () => {
    try {
      setShowPrompts(true);
      setState((prev) => ({ ...prev, error: null }));

      // Call the backend API directly for immediate response
      const response = await fetch("/api/linkedin/generate-image-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_type: contentType,
          topic,
          industry,
          content,
        }),
      });

      if (response.ok) {
        const apiPrompts = await response.json();
        if (apiPrompts && apiPrompts.length >= 3) {
          setPrompts(apiPrompts);
        } else {
          throw new Error("API returned insufficient prompts");
        }
      } else {
        throw new Error(`API call failed: ${response.status}`);
      }
    } catch (error) {
      console.error("Error generating prompts:", error);

      // Fallback to predefined prompts if API fails
      setPrompts([
        {
          style: "Professional",
          prompt: `Create a professional LinkedIn ${contentType} image for ${topic} in the ${industry} industry with corporate aesthetics, clean lines, and professional color palette.`,
          description: "Clean, business-appropriate visual for LinkedIn",
          prompt_index: 0,
        },
        {
          style: "Creative",
          prompt: `Generate a creative LinkedIn ${contentType} image for ${topic} with eye-catching design, vibrant colors while maintaining professional appeal, and social media engagement optimization.`,
          description: "Eye-catching, shareable design for LinkedIn",
          prompt_index: 1,
        },
        {
          style: "Industry-Specific",
          prompt: `Design a ${industry} industry-specific LinkedIn ${contentType} image for ${topic} with industry-relevant imagery, colors, and visual elements that appeal to business professionals.`,
          description: `Industry-tailored professional design for ${industry}`,
          prompt_index: 2,
        },
      ]);

      setState((prev) => ({
        ...prev,
        error:
          "Using fallback prompts due to API error. Please try again later.",
      }));
    }
  };

  // Handle prompt selection and image generation
  const handlePromptSelect = async (prompt: ImagePrompt) => {
    setState((prev) => ({ ...prev, selectedPrompt: prompt }));

    try {
      setState((prev) => ({
        ...prev,
        isGenerating: true,
        error: null,
        progress: 0,
      }));

      // Call the actual backend API for image generation
      const response = await fetch("/api/linkedin/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.prompt,
          content_context: {
            topic,
            industry,
            content_type: contentType,
            content,
            style: prompt.style,
          },
          aspect_ratio: "1:1",
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Image generation failed: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();

      if (result.success) {
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          generatedImage: result,
          progress: 100,
        }));

        if (onImageGenerated) {
          onImageGenerated(result);
        }
      } else {
        throw new Error(result.error || "Image generation failed");
      }
    } catch (error) {
      console.error("Error generating image:", error);
      setState((prev) => ({
        ...prev,
        isGenerating: false,
        error:
          error instanceof Error ? error.message : "Failed to generate image",
      }));
    }
  };

  // Progress simulation for better UX
  useEffect(() => {
    if (state.isGenerating) {
      const interval = setInterval(() => {
        setState((prev) => ({
          ...prev,
          progress: Math.min(prev.progress + Math.random() * 15, 90),
        }));
      }, 500);

      return () => clearInterval(interval);
    }
  }, [state.isGenerating]);

  return (
    <div className={`image-generation-suggestions ${className}`}>
      {/* Main Suggestion Card */}
      {!showPrompts && !state.generatedImage && (
        <div className="suggestion-card">
          <div className="suggestion-header">
            <div className="suggestion-icon">
              <PhotoIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="suggestion-content">
              <h3 className="suggestion-title">
                Enhance Your{" "}
                {contentType.charAt(0).toUpperCase() + contentType.slice(1)}{" "}
                with AI-Generated Images
              </h3>
              <p className="suggestion-description">
                Create professional, LinkedIn-optimized images that perfectly
                complement your content and boost engagement.
              </p>
            </div>
          </div>

          <div className="suggestion-features">
            <div className="feature-item">
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
              <span>3 distinct visual styles</span>
            </div>
            <div className="feature-item">
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
              <span>Content-aware prompts</span>
            </div>
            <div className="feature-item">
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
              <span>LinkedIn-optimized</span>
            </div>
          </div>

          <button
            onClick={handleGeneratePrompts}
            className="generate-prompts-btn"
            disabled={state.isGenerating}
          >
            <SparklesIcon className="h-4 w-4" />
            Generate Image Prompts
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Prompt Selection */}
      {showPrompts && !state.isGenerating && !state.generatedImage && (
        <div className="prompts-selection">
          <div className="prompts-header">
            <h3 className="prompts-title">Choose Your Visual Style</h3>
            <p className="prompts-subtitle">
              Select from three AI-optimized image styles that match your
              content
            </p>
          </div>

          <div className="prompts-grid">
            {prompts.map((prompt) => (
              <div
                key={prompt.prompt_index}
                className={`prompt-card ${state.selectedPrompt?.prompt_index === prompt.prompt_index ? "selected" : ""}`}
                onClick={() => handlePromptSelect(prompt)}
              >
                <div className="prompt-header">
                  <div className="prompt-style-badge">{prompt.style}</div>
                </div>
                <div className="prompt-content">
                  <p className="prompt-description">{prompt.description}</p>
                  <div className="prompt-preview">
                    {prompt.prompt.substring(0, 120)}...
                  </div>
                </div>
                <div className="prompt-actions">
                  <button className="select-prompt-btn">
                    Select & Generate
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => setShowPrompts(false)} className="back-btn">
            ← Back to Suggestions
          </button>
        </div>
      )}

      {/* Image Generation Progress */}
      {state.isGenerating && (
        <div className="generation-progress">
          <div className="progress-header">
            <PhotoIcon className="h-6 w-6 text-blue-600 animate-pulse" />
            <h3 className="progress-title">Generating Your Image</h3>
          </div>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${state.progress}%` }}
            />
          </div>

          <div className="progress-status">
            <span className="progress-text">
              {state.selectedPrompt?.style} style • {Math.round(state.progress)}
              % complete
            </span>
          </div>

          <div className="progress-message">
            Creating a professional, LinkedIn-optimized image...
          </div>
        </div>
      )}

      {/* Generated Image Display */}
      {state.generatedImage && (
        <div className="generated-image">
          <div className="image-header">
            <CheckCircleIcon className="h-6 w-6 text-green-500" />
            <h3 className="image-title">Image Generated Successfully!</h3>
          </div>

          <div className="image-preview">
            <img
              src={
                state.generatedImage.image_url ||
                "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDMwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjE1MCIgeT0iMTUwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2QjcyODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBHZW5lcmF0ZWQ8L3RleHQ+Cjwvc3ZnPgo="
              }
              alt="Generated LinkedIn image"
              className="preview-image"
            />
          </div>

          <div className="image-actions">
            <button className="action-btn primary">
              <PhotoIcon className="h-4 w-4" />
              Use This Image
            </button>
            <button className="action-btn secondary">
              <SparklesIcon className="h-4 w-4" />
              Generate Another
            </button>
            <button className="action-btn secondary">
              <ArrowRightIcon className="h-4 w-4" />
              Edit Image
            </button>
          </div>

          <div className="image-metadata">
            <div className="metadata-item">
              <span className="metadata-label">Style:</span>
              <span className="metadata-value">
                {state.selectedPrompt?.style}
              </span>
            </div>
            <div className="metadata-item">
              <span className="metadata-label">Aspect Ratio:</span>
              <span className="metadata-value">1:1 (Square)</span>
            </div>
            <div className="metadata-item">
              <span className="metadata-label">Optimized for:</span>
              <span className="metadata-value">LinkedIn {contentType}</span>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {state.error && (
        <div className="error-message">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
          <span className="error-text">{state.error}</span>
          <button
            onClick={() => setState((prev) => ({ ...prev, error: null }))}
            className="error-dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageGenerationSuggestions;
