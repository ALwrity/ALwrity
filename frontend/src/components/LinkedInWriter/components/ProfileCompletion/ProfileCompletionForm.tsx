import React, { useMemo, useState } from 'react';
import { CircularProgress } from '@mui/material';

import type { LinkedInCompletionQuestion } from '../../../../api/linkedinSocial';
import { linkedInPlaceholderCardStyles } from '../linkedInPlaceholderStyles';

export interface ProfileCompletionFormProps {
  questions: LinkedInCompletionQuestion[];
  onSubmit: (answers: Record<string, string | string[]>) => Promise<void>;
  isSubmitting?: boolean;
  error?: string | null;
}

const fieldWrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  width: '100%',
};

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#334155',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  backgroundColor: '#fff',
  fontSize: 14,
  color: '#334155',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

function parseTagsValue(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildAnswersFromForm(
  questions: LinkedInCompletionQuestion[],
  values: Record<string, string>
): Record<string, string | string[]> {
  const answers: Record<string, string | string[]> = {};

  for (const question of questions) {
    const raw = values[question.field_key]?.trim() ?? '';
    if (!raw) {
      continue;
    }

    if (question.input_type === 'tags') {
      const tags = parseTagsValue(raw);
      if (tags.length > 0) {
        answers[question.field_key] = tags;
      }
      continue;
    }

    answers[question.field_key] = raw;
  }

  return answers;
}

export const ProfileCompletionForm: React.FC<ProfileCompletionFormProps> = ({
  questions,
  onSubmit,
  isSubmitting = false,
  error = null,
}) => {
  const initialValues = useMemo(() => {
    const next: Record<string, string> = {};
    for (const question of questions) {
      next[question.field_key] = '';
    }
    return next;
  }, [questions]);

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [localError, setLocalError] = useState<string | null>(null);

  React.useEffect(() => {
    setValues(initialValues);
    setLocalError(null);
  }, [initialValues]);

  const handleChange = (fieldKey: string, value: string) => {
    setValues((prev) => ({ ...prev, [fieldKey]: value }));
    setLocalError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    const answers = buildAnswersFromForm(questions, values);
    if (Object.keys(answers).length === 0) {
      setLocalError('Please answer at least one question.');
      return;
    }

    try {
      await onSubmit(answers);
    } catch {
      // Parent sets submitError; keep form values for retry.
    }
  };

  if (questions.length === 0) {
    return null;
  }

  const displayError = localError ?? error;

  return (
    <div style={{ ...linkedInPlaceholderCardStyles.wrapper, marginTop: 16 }}>
      <div style={linkedInPlaceholderCardStyles.inner}>
        <form
          onSubmit={handleSubmit}
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            maxWidth: 560,
            margin: '0 auto',
          }}
        >
          <div>
            <h3
              style={{
                margin: '0 0 6px',
                fontSize: 18,
                fontWeight: 700,
                color: '#0f172a',
              }}
            >
              Help us understand you better.
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
              Please answer a few quick questions.
            </p>
          </div>

          {questions.map((question) => (
            <div key={question.field_key} style={fieldWrapperStyle}>
              <label htmlFor={question.field_key} style={labelStyle}>
                {question.label}
                {question.required ? ' *' : ''}
              </label>
              {question.input_type === 'textarea' ? (
                <textarea
                  id={question.field_key}
                  value={values[question.field_key] ?? ''}
                  onChange={(event) =>
                    handleChange(question.field_key, event.target.value)
                  }
                  rows={4}
                  disabled={isSubmitting}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 96 }}
                />
              ) : (
                <input
                  id={question.field_key}
                  type="text"
                  value={values[question.field_key] ?? ''}
                  onChange={(event) =>
                    handleChange(question.field_key, event.target.value)
                  }
                  disabled={isSubmitting}
                  placeholder={
                    question.input_type === 'tags'
                      ? 'e.g. Python, FastAPI, Leadership'
                      : undefined
                  }
                  style={inputStyle}
                />
              )}
            </div>
          ))}

          {displayError && (
            <p
              role="alert"
              style={{
                margin: 0,
                padding: '10px 12px',
                borderRadius: 8,
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {displayError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              alignSelf: 'flex-start',
              background: 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
              border: 'none',
              borderRadius: 12,
              padding: '12px 28px',
              color: 'white',
              fontSize: 15,
              fontWeight: 700,
              cursor: isSubmitting ? 'default' : 'pointer',
              opacity: isSubmitting ? 0.75 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {isSubmitting && <CircularProgress size={18} sx={{ color: '#fff' }} />}
            {isSubmitting ? 'Saving...' : 'Save answers'}
          </button>
        </form>
      </div>
    </div>
  );
};
