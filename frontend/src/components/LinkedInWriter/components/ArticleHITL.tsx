import React from "react";
import {
  linkedInWriterApi,
  LinkedInArticleRequest,
} from "../../../services/linkedInWriterApi";
import {
  readPrefs,
  writePrefs,
  logAssistant,
  mapTone,
  mapIndustry,
  mapSearchEngine,
  getPersonalizedPlaceholder,
  VALID_TONES,
  VALID_INDUSTRIES,
  VALID_SEARCH_ENGINES,
} from "../utils/linkedInWriterUtils";
import { dispatchLinkedInDraftUpdate } from "../utils/linkedInDraftContentTypeStorage";
import { buildArticleDraftUpdate } from "../utils/linkedInArticleDraftUtils";
import { saveArticleDraftState } from "../utils/linkedInArticleDraftStorage";
import { CustomToneSelect } from "./CustomToneSelect";
import { isCustomToneSelection } from "../utils/storageUtils";

interface ArticleHITLProps {
  args: any;
  respond: (data: any) => void;
}

const ArticleHITL: React.FC<ArticleHITLProps> = ({ args, respond }) => {
  const prefs = React.useMemo(() => readPrefs(), []);
  const [form, setForm] = React.useState({
    topic: args.topic ?? prefs.topic ?? "",
    target_audience: args.target_audience ?? prefs.target_audience ?? "",
    tone: args.tone ?? prefs.tone ?? "professional",
    industry: args.industry ?? prefs.industry ?? "technology",
    key_sections: args.key_sections ?? prefs.key_sections ?? [],
    include_images: args.include_images ?? prefs.include_images ?? true,
    seo_optimization: args.seo_optimization ?? prefs.seo_optimization ?? true,
    research_enabled: args.research_enabled ?? prefs.research_enabled ?? true,
    word_count: args.word_count ?? prefs.word_count ?? 800,
    search_engine: args.search_engine ?? prefs.search_engine ?? "google",
  });

  const [customTone, setCustomTone] = React.useState(
    args?.custom_tone ?? prefs.custom_tone ?? "",
  );
  const [isLoading, setIsLoading] = React.useState(false);

  const run = async () => {
    try {
      if (isCustomToneSelection(form.tone) && !customTone.trim()) {
        logAssistant("Please enter a custom tone or select a preset tone.");
        return;
      }
      setIsLoading(true);

      // Emit loading start event
      window.dispatchEvent(
        new CustomEvent("linkedinwriter:loadingStart", {
          detail: {
            action: "Generating LinkedIn Article",
            message: `Creating a comprehensive LinkedIn article about "${form.topic}" for your ${form.target_audience}. This will include ${form.key_sections?.length || "several"} key sections and take approximately ${Math.round(form.word_count / 200)} minutes to read.`,
          },
        }),
      );

      logAssistant("Starting LinkedIn article generation...");

      // Read user preferences
      const prefs = readPrefs();
      if (prefs) {
        form.tone = prefs.tone || form.tone;
        form.industry = prefs.industry || form.industry;
      }

      // Normalize and map enum values
      const request: LinkedInArticleRequest = {
        topic: form.topic,
        target_audience: form.target_audience,
        tone: mapTone(form.tone, customTone),
        industry: mapIndustry(form.industry),
        key_sections: form.key_sections,
        include_images: form.include_images,
        seo_optimization: form.seo_optimization,
        research_enabled: form.research_enabled,
        word_count: form.word_count,
        search_engine: mapSearchEngine(form.search_engine),
      };

      const res = await linkedInWriterApi.generateArticle(request);

      // Write preferences
      writePrefs({
        tone: form.tone,
        custom_tone: customTone,
        industry: form.industry,
        target_audience: form.target_audience,
        key_sections: form.key_sections,
        include_images: form.include_images,
        seo_optimization: form.seo_optimization,
        research_enabled: form.research_enabled,
        word_count: form.word_count,
        search_engine: form.search_engine,
      });

      logAssistant("LinkedIn article generated successfully");

      // Update draft content
      if (res.data) {
        const { state: articleState, markdown: content } =
          buildArticleDraftUpdate(res.data);
        saveArticleDraftState(articleState);
        window.dispatchEvent(
          new CustomEvent("linkedinwriter:updateArticleDraft", {
            detail: articleState,
          }),
        );

        // Emit loading end event
        window.dispatchEvent(
          new CustomEvent("linkedinwriter:loadingEnd", { detail: {} }),
        );

        dispatchLinkedInDraftUpdate(content, "article");

        respond({
          success: true,
          article: res.data.content,
          title: res.data.title,
          word_count: res.data.word_count,
          reading_time: res.data.reading_time,
        });
      } else {
        throw new Error("No data received from API");
      }
    } catch (error) {
      console.error("LinkedIn Article Generation Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      // Emit loading end event with error
      window.dispatchEvent(
        new CustomEvent("linkedinwriter:loadingEnd", {
          detail: { error: errorMessage },
        }),
      );

      logAssistant(`Error generating LinkedIn article: ${errorMessage}`);
      respond({
        success: false,
        error: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="hitl-form linkedin-article-form">
      <h3>Generate LinkedIn Article</h3>

      <div className="form-group">
        <label htmlFor="topic">Article Topic *</label>
        <input
          id="topic"
          type="text"
          value={form.topic}
          onChange={(e) => setForm({ ...form, topic: e.target.value })}
          placeholder={getPersonalizedPlaceholder("article", "topic", prefs)}
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
            "article",
            "target_audience",
            prefs,
          )}
        />
      </div>

      <div className="form-group">
        <CustomToneSelect
          id="tone"
          tone={form.tone}
          customTone={customTone}
          presets={VALID_TONES}
          onChange={({ tone, custom_tone }) => {
            setForm({ ...form, tone });
            setCustomTone(custom_tone ?? "");
          }}
          formatOption={(tone) =>
            tone.charAt(0).toUpperCase() + tone.slice(1)
          }
        />
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
        <label htmlFor="key_sections">Key Sections to Cover</label>
        <textarea
          id="key_sections"
          value={form.key_sections?.join("\n") || ""}
          onChange={(e) =>
            setForm({
              ...form,
              key_sections: e.target.value.split("\n").filter((s) => s.trim()),
            })
          }
          placeholder={getPersonalizedPlaceholder(
            "article",
            "key_sections",
            prefs,
          )}
          rows={3}
        />
      </div>

      <div className="form-group">
        <label htmlFor="word_count">Word Count</label>
        <select
          id="word_count"
          value={form.word_count}
          onChange={(e) =>
            setForm({ ...form, word_count: parseInt(e.target.value) })
          }
        >
          <option value={500}>500 words (Quick read)</option>
          <option value={800}>800 words (Standard)</option>
          <option value={1200}>1200 words (Detailed)</option>
          <option value={1500}>1500 words (Comprehensive)</option>
        </select>
      </div>

      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={form.include_images}
            onChange={(e) =>
              setForm({ ...form, include_images: e.target.checked })
            }
          />
          Include relevant images and visuals
        </label>
      </div>

      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={form.seo_optimization}
            onChange={(e) =>
              setForm({ ...form, seo_optimization: e.target.checked })
            }
          />
          Enable SEO optimization
        </label>
      </div>

      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={form.research_enabled}
            onChange={(e) =>
              setForm({ ...form, research_enabled: e.target.checked })
            }
          />
          Enable research and fact-checking
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="search_engine">Research Source</label>
        <select
          id="search_engine"
          value={form.search_engine}
          onChange={(e) => setForm({ ...form, search_engine: e.target.value })}
        >
          {VALID_SEARCH_ENGINES.map((engine) => (
            <option key={engine} value={engine}>
              {engine.charAt(0).toUpperCase() + engine.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="form-actions">
        <button
          onClick={run}
          disabled={isLoading || !form.topic.trim()}
          className="generate-btn"
        >
          {isLoading ? "Generating Article..." : "Generate Article"}
        </button>
      </div>
    </div>
  );
};

export default ArticleHITL;
