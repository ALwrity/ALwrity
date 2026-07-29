import React from "react";
import {
  linkedInWriterApi,
  LinkedInCommentResponseRequest,
} from "../../../services/linkedInWriterApi";
import {
  readPrefs,
  writePrefs,
  logAssistant,
  mapTone,
  getPersonalizedPlaceholder,
  VALID_TONES,
  VALID_RESPONSE_TYPES,
} from "../utils/linkedInWriterUtils";

interface CommentResponseHITLProps {
  args: any;
  respond: (data: any) => void;
}

const CommentResponseHITL: React.FC<CommentResponseHITLProps> = ({
  args,
  respond,
}) => {
  const prefs = React.useMemo(() => readPrefs(), []);
  const [form, setForm] = React.useState({
    original_post: args.original_post ?? prefs.original_post ?? "",
    comment: args.comment ?? prefs.comment ?? "",
    response_type: args.response_type ?? prefs.response_type ?? "professional",
    tone: args.tone ?? prefs.tone ?? "professional",
    include_question: args.include_question ?? prefs.include_question ?? false,
    brand_voice: args.brand_voice ?? prefs.brand_voice ?? "",
  });

  const [isLoading, setIsLoading] = React.useState(false);

  const run = async () => {
    try {
      setIsLoading(true);

      // Emit loading start event
      window.dispatchEvent(
        new CustomEvent("linkedinwriter:loadingStart", {
          detail: {
            action: "Generating LinkedIn Comment Response",
            message: `Creating a ${form.response_type} response to a LinkedIn comment. This will maintain a ${form.tone} tone while providing valuable engagement.`,
          },
        }),
      );

      logAssistant("Starting LinkedIn comment response generation...");

      // Read user preferences
      const prefs = readPrefs();
      if (prefs) {
        form.tone = prefs.tone || form.tone;
      }

      // Normalize and map enum values
      const request: LinkedInCommentResponseRequest = {
        original_post: form.original_post,
        comment: form.comment,
        response_type: form.response_type as
          | "professional"
          | "appreciative"
          | "clarifying"
          | "disagreement"
          | "value_add",
        tone: mapTone(form.tone),
        include_question: form.include_question,
        brand_voice: form.brand_voice,
      };

      const res = await linkedInWriterApi.generateCommentResponse(request);

      // Write preferences
      writePrefs({
        tone: form.tone,
        response_type: form.response_type,
        include_question: form.include_question,
        brand_voice: form.brand_voice,
      });

      logAssistant("LinkedIn comment response generated successfully");

      // Update draft content
      if (res.response) {
        window.dispatchEvent(
          new CustomEvent("linkedinwriter:updateDraft", {
            detail: res.response,
          }),
        );

        respond({
          success: true,
          response: res.response,
          alternative_responses: res.alternative_responses || [],
          tone_analysis: res.tone_analysis,
        });
      } else {
        throw new Error("No response received from API");
      }
    } catch (error) {
      console.error("LinkedIn Comment Response Generation Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      logAssistant(
        `Error generating LinkedIn comment response: ${errorMessage}`,
      );
      respond({
        success: false,
        error: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="hitl-form linkedin-comment-response-form">
      <h3>Generate LinkedIn Comment Response</h3>

      <div className="form-group">
        <label htmlFor="original_post">Original Post Content *</label>
        <textarea
          id="original_post"
          value={form.original_post}
          onChange={(e) => setForm({ ...form, original_post: e.target.value })}
          placeholder={getPersonalizedPlaceholder(
            "comment",
            "original_post",
            prefs,
          )}
          rows={3}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="comment">Comment to Respond To *</label>
        <textarea
          id="comment"
          value={form.comment}
          onChange={(e) => setForm({ ...form, comment: e.target.value })}
          placeholder={getPersonalizedPlaceholder("comment", "comment", prefs)}
          rows={3}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="response_type">Response Type</label>
        <select
          id="response_type"
          value={form.response_type}
          onChange={(e) => setForm({ ...form, response_type: e.target.value })}
        >
          {VALID_RESPONSE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>
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
        <label htmlFor="brand_voice">Brand Voice (Optional)</label>
        <input
          id="brand_voice"
          type="text"
          value={form.brand_voice}
          onChange={(e) => setForm({ ...form, brand_voice: e.target.value })}
          placeholder={getPersonalizedPlaceholder(
            "comment",
            "brand_voice",
            prefs,
          )}
        />
      </div>

      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={form.include_question}
            onChange={(e) =>
              setForm({ ...form, include_question: e.target.checked })
            }
          />
          Include a question to encourage engagement
        </label>
      </div>

      <div className="form-actions">
        <button
          onClick={run}
          disabled={
            isLoading || !form.original_post.trim() || !form.comment.trim()
          }
          className="generate-btn"
        >
          {isLoading ? "Generating Response..." : "Generate Response"}
        </button>
      </div>
    </div>
  );
};

export default CommentResponseHITL;
