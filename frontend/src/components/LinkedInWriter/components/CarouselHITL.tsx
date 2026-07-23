import React from "react";
import {
  linkedInWriterApi,
  LinkedInCarouselRequest,
} from "../../../services/linkedInWriterApi";
import {
  readPrefs,
  writePrefs,
  logAssistant,
  mapTone,
  mapIndustry,
  getPersonalizedPlaceholder,
  VALID_TONES,
  VALID_INDUSTRIES,
} from "../utils/linkedInWriterUtils";

interface CarouselHITLProps {
  args: any;
  respond: (data: any) => void;
}

const CarouselHITL: React.FC<CarouselHITLProps> = ({ args, respond }) => {
  const prefs = React.useMemo(() => readPrefs(), []);
  const [form, setForm] = React.useState({
    topic: args.topic ?? prefs.topic ?? "",
    target_audience: args.target_audience ?? prefs.target_audience ?? "",
    tone: args.tone ?? prefs.tone ?? "professional",
    industry: args.industry ?? prefs.industry ?? "technology",
    number_of_slides: args.number_of_slides ?? prefs.number_of_slides ?? 5,
    key_takeaways: args.key_takeaways ?? prefs.key_takeaways ?? [],
    include_cover_slide:
      args.include_cover_slide ?? prefs.include_cover_slide ?? true,
    include_cta_slide:
      args.include_cta_slide ?? prefs.include_cta_slide ?? true,
    visual_style: args.visual_style ?? prefs.visual_style ?? "professional",
  });

  const [isLoading, setIsLoading] = React.useState(false);

  const run = async () => {
    try {
      setIsLoading(true);

      // Emit loading start event
      window.dispatchEvent(
        new CustomEvent("linkedinwriter:loadingStart", {
          detail: {
            action: "Generating LinkedIn Carousel",
            message: `Creating a ${form.number_of_slides}-slide LinkedIn carousel about "${form.topic}". This visual content will engage your ${form.target_audience} with a ${form.visual_style} design approach.`,
          },
        }),
      );

      logAssistant("Starting LinkedIn carousel generation...");

      // Read user preferences
      const prefs = readPrefs();
      if (prefs) {
        form.tone = prefs.tone || form.tone;
        form.industry = prefs.industry || form.industry;
      }

      // Normalize and map enum values
      const request: LinkedInCarouselRequest = {
        topic: form.topic,
        target_audience: form.target_audience,
        tone: mapTone(form.tone),
        industry: mapIndustry(form.industry),
        number_of_slides: form.number_of_slides,
        key_takeaways: form.key_takeaways,
        include_cover_slide: form.include_cover_slide,
        include_cta_slide: form.include_cta_slide,
        visual_style: form.visual_style,
      };

      const res = await linkedInWriterApi.generateCarousel(request);

      // Write preferences
      writePrefs({
        tone: form.tone,
        industry: form.industry,
        target_audience: form.target_audience,
        number_of_slides: form.number_of_slides,
        key_takeaways: form.key_takeaways,
        include_cover_slide: form.include_cover_slide,
        include_cta_slide: form.include_cta_slide,
        visual_style: form.visual_style,
      });

      logAssistant("LinkedIn carousel generated successfully");

      // Update draft content
      if (res.data) {
        let content = `# ${res.data.title}\n\n`;
        res.data.slides.forEach((slide, index) => {
          content += `## Slide ${index + 1}: ${slide.title}\n\n${slide.content}\n\n`;
        });

        // Emit loading end event
        window.dispatchEvent(
          new CustomEvent("linkedinwriter:loadingEnd", { detail: {} }),
        );

        window.dispatchEvent(
          new CustomEvent("linkedinwriter:updateDraft", {
            detail: content,
          }),
        );

        respond({
          success: true,
          carousel_content: content,
          title: res.data.title,
          number_of_slides: res.data.slides.length,
        });
      } else {
        throw new Error("No data received from API");
      }
    } catch (error) {
      console.error("LinkedIn Carousel Generation Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      // Emit loading end event with error
      window.dispatchEvent(
        new CustomEvent("linkedinwriter:loadingEnd", {
          detail: { error: errorMessage },
        }),
      );

      logAssistant(`Error generating LinkedIn carousel: ${errorMessage}`);
      respond({
        success: false,
        error: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="hitl-form linkedin-carousel-form">
      <h3>Generate LinkedIn Carousel</h3>

      <div className="form-group">
        <label htmlFor="topic">Carousel Topic *</label>
        <input
          id="topic"
          type="text"
          value={form.topic}
          onChange={(e) => setForm({ ...form, topic: e.target.value })}
          placeholder={getPersonalizedPlaceholder("carousel", "topic", prefs)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="target_audience">Target Audience</label>
        <input
          id="target_audience"
          type="text"
          value={form.target_audience}
          onChange={(e) =>
            setForm({ ...form, target_audience: e.target.value })
          }
          placeholder={getPersonalizedPlaceholder(
            "carousel",
            "target_audience",
            prefs,
          )}
        />
      </div>

      <div className="form-group">
        <label htmlFor="tone">Tone</label>
        <select
          id="tone"
          value={form.tone}
          onChange={(e) => setForm({ ...form, tone: e.target.value })}
        >
          {VALID_TONES.map((tone) => (
            <option key={tone} value={tone}>
              {tone.charAt(0).toUpperCase() + tone.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="industry">Industry</label>
        <select
          id="industry"
          value={form.industry}
          onChange={(e) => setForm({ ...form, industry: e.target.value })}
        >
          {VALID_INDUSTRIES.map((industry) => (
            <option key={industry} value={industry}>
              {industry.charAt(0).toUpperCase() + industry.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="number_of_slides">Number of Slides</label>
        <select
          id="number_of_slides"
          value={form.number_of_slides}
          onChange={(e) =>
            setForm({ ...form, number_of_slides: parseInt(e.target.value) })
          }
        >
          <option value={3}>3 slides (Quick overview)</option>
          <option value={5}>5 slides (Standard)</option>
          <option value={7}>7 slides (Detailed)</option>
          <option value={10}>10 slides (Comprehensive)</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="key_takeaways">Key Takeaways</label>
        <textarea
          id="key_takeaways"
          value={form.key_takeaways?.join("\n") || ""}
          onChange={(e) =>
            setForm({
              ...form,
              key_takeaways: e.target.value.split("\n").filter((s) => s.trim()),
            })
          }
          placeholder={getPersonalizedPlaceholder(
            "carousel",
            "key_takeaways",
            prefs,
          )}
          rows={3}
        />
      </div>

      <div className="form-group">
        <label htmlFor="visual_style">Visual Style</label>
        <select
          id="visual_style"
          value={form.visual_style}
          onChange={(e) => setForm({ ...form, visual_style: e.target.value })}
        >
          <option value="professional">Professional</option>
          <option value="modern">Modern</option>
          <option value="minimalist">Minimalist</option>
          <option value="bold">Bold & Colorful</option>
          <option value="elegant">Elegant</option>
        </select>
      </div>

      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={form.include_cover_slide}
            onChange={(e) =>
              setForm({ ...form, include_cover_slide: e.target.checked })
            }
          />
          Include cover slide
        </label>
      </div>

      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={form.include_cta_slide}
            onChange={(e) =>
              setForm({ ...form, include_cta_slide: e.target.checked })
            }
          />
          Include call-to-action slide
        </label>
      </div>

      <div className="form-actions">
        <button
          onClick={run}
          disabled={isLoading || !form.topic.trim()}
          className="generate-btn"
        >
          {isLoading ? "Generating Carousel..." : "Generate Carousel"}
        </button>
      </div>
    </div>
  );
};

export default CarouselHITL;
