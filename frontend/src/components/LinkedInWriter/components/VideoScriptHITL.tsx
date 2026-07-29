import React from "react";
import {
  linkedInWriterApi,
  LinkedInVideoScriptRequest,
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
import { CustomToneSelect } from "./CustomToneSelect";
import { isCustomToneSelection } from "../utils/storageUtils";

interface VideoScriptHITLProps {
  args: any;
  respond: (data: any) => void;
}

const VideoScriptHITL: React.FC<VideoScriptHITLProps> = ({ args, respond }) => {
  const prefs = React.useMemo(() => readPrefs(), []);
  const [form, setForm] = React.useState({
    topic: args.topic ?? prefs.topic ?? "",
    target_audience: args.target_audience ?? prefs.target_audience ?? "",
    tone: args.tone ?? prefs.tone ?? "professional",
    industry: args.industry ?? prefs.industry ?? "technology",
    video_length: args.video_length ?? prefs.video_length ?? 60,
    key_messages: args.key_messages ?? prefs.key_messages ?? [],
    include_hook: args.include_hook ?? prefs.include_hook ?? true,
    include_captions: args.include_captions ?? prefs.include_captions ?? true,
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
            action: "Generating LinkedIn Video Script",
            message: `Creating a ${form.video_length}-second video script about "${form.topic}". This will include a compelling hook, engaging content, and clear conclusion for your ${form.target_audience}.`,
          },
        }),
      );

      logAssistant("Starting LinkedIn video script generation...");

      // Read user preferences
      const prefs = readPrefs();
      if (prefs) {
        form.tone = prefs.tone || form.tone;
        form.industry = prefs.industry || form.industry;
      }

      // Normalize and map enum values
      const request: LinkedInVideoScriptRequest = {
        topic: form.topic,
        target_audience: form.target_audience,
        tone: mapTone(form.tone, customTone),
        industry: mapIndustry(form.industry),
        video_length: form.video_length,
        key_messages: form.key_messages,
        include_hook: form.include_hook,
        include_captions: form.include_captions,
      };

      const res = await linkedInWriterApi.generateVideoScript(request);

      // Write preferences
      writePrefs({
        tone: form.tone,
        custom_tone: customTone,
        industry: form.industry,
        target_audience: form.target_audience,
        video_length: form.video_length,
        key_messages: form.key_messages,
        include_hook: form.include_hook,
        include_captions: form.include_captions,
      });

      logAssistant("LinkedIn video script generated successfully");

      // Update draft content
      if (res.data) {
        let content = `# Video Script: ${form.topic}\n\n`;
        content += `## Hook\n${res.data.hook}\n\n`;
        content += `## Main Content\n`;
        res.data.main_content.forEach((scene, index) => {
          content += `### Scene ${index + 1} (${scene.duration || "30s"})\n${scene.content}\n\n`;
        });
        content += `## Conclusion\n${res.data.conclusion}\n\n`;
        content += `## Video Description\n${res.data.video_description}\n\n`;

        if (res.data.captions) {
          content += `## Captions\n${res.data.captions.join("\n")}\n\n`;
        }

        window.dispatchEvent(
          new CustomEvent("linkedinwriter:updateDraft", {
            detail: content,
          }),
        );

        respond({
          success: true,
          video_script: content,
          hook: res.data.hook,
          main_content: res.data.main_content,
          conclusion: res.data.conclusion,
          captions: res.data.captions,
          video_description: res.data.video_description,
        });
      } else {
        throw new Error("No data received from API");
      }
    } catch (error) {
      console.error("LinkedIn Video Script Generation Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      logAssistant(`Error generating LinkedIn video script: ${errorMessage}`);
      respond({
        success: false,
        error: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="hitl-form linkedin-video-script-form">
      <h3>Generate LinkedIn Video Script</h3>

      <div className="form-group">
        <label htmlFor="topic">Video Topic *</label>
        <input
          id="topic"
          type="text"
          value={form.topic}
          onChange={(e) => setForm({ ...form, topic: e.target.value })}
          placeholder={getPersonalizedPlaceholder("video", "topic", prefs)}
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
            "video",
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
        <label htmlFor="video_length">Video Length (seconds)</label>
        <select
          id="video_length"
          value={form.video_length}
          onChange={(e) =>
            setForm({ ...form, video_length: parseInt(e.target.value) })
          }
        >
          <option value={30}>30 seconds (Quick tip)</option>
          <option value={60}>60 seconds (Standard)</option>
          <option value={90}>90 seconds (Detailed)</option>
          <option value={120}>120 seconds (Comprehensive)</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="key_messages">Key Messages</label>
        <textarea
          id="key_messages"
          value={form.key_messages?.join("\n") || ""}
          onChange={(e) =>
            setForm({
              ...form,
              key_messages: e.target.value.split("\n").filter((s) => s.trim()),
            })
          }
          placeholder={getPersonalizedPlaceholder(
            "video",
            "key_messages",
            prefs,
          )}
          rows={3}
        />
      </div>

      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={form.include_hook}
            onChange={(e) =>
              setForm({ ...form, include_hook: e.target.checked })
            }
          />
          Include attention-grabbing hook
        </label>
      </div>

      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={form.include_captions}
            onChange={(e) =>
              setForm({ ...form, include_captions: e.target.checked })
            }
          />
          Include video captions
        </label>
      </div>

      <div className="form-actions">
        <button
          onClick={run}
          disabled={isLoading || !form.topic.trim()}
          className="generate-btn"
        >
          {isLoading ? "Generating Video Script..." : "Generate Video Script"}
        </button>
      </div>
    </div>
  );
};

export default VideoScriptHITL;
