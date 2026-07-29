import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  filterLinkedInIndustries,
  LINKEDIN_INDUSTRY_MAX_QUERY_LENGTH,
  type LinkedInIndustryItem,
} from "../utils/filterLinkedInIndustries";

const LOG_PREFIX = "[LinkedInIndustryAutocomplete]";

export interface LinkedInIndustryAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  /** Full industry catalog — filtered locally as the user types. */
  items: LinkedInIndustryItem[];
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
}

const SearchIcon: React.FC = () => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="#666"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

function highlightMatch(title: string, query: string): React.ReactNode {
  const trimmed = query.trim();
  if (!trimmed) {
    return title;
  }

  const lowerTitle = title.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const index = lowerTitle.indexOf(lowerQuery);
  if (index < 0) {
    return title;
  }

  return (
    <>
      {title.slice(0, index)}
      <strong style={{ fontWeight: 600 }}>{title.slice(index, index + trimmed.length)}</strong>
      {title.slice(index + trimmed.length)}
    </>
  );
}

export const LinkedInIndustryAutocomplete: React.FC<
  LinkedInIndustryAutocompleteProps
> = ({
  value,
  onChange,
  items,
  placeholder = "e.g., Technology",
  disabled = false,
  isLoading = false,
}) => {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const suggestions = useMemo(() => {
    if (value.trim().length > LINKEDIN_INDUSTRY_MAX_QUERY_LENGTH) {
      return [];
    }
    return filterLinkedInIndustries(items, value);
  }, [items, value]);

  const showDropdown =
    isOpen && !disabled && (isLoading || suggestions.length > 0);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeIndex >= suggestions.length) {
      setActiveIndex(suggestions.length > 0 ? 0 : -1);
    }
  }, [activeIndex, suggestions.length]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  const selectSuggestion = useCallback(
    (item: LinkedInIndustryItem) => {
      if (!item?.title) {
        console.debug(`${LOG_PREFIX} ignored invalid suggestion selection`);
        return;
      }
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      onChange(item.title);
      closeDropdown();
      inputRef.current?.focus();
    },
    [closeDropdown, onChange],
  );

  const handleFocus = () => {
    if (disabled) {
      return;
    }
    if (value.trim() && (suggestions.length > 0 || isLoading)) {
      setIsOpen(true);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    onChange(next);
    if (!disabled && next.trim()) {
      setIsOpen(true);
      setActiveIndex(0);
    } else {
      closeDropdown();
    }
  };

  const handleBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
      closeDropdown();
    }, 150);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      closeDropdown();
      return;
    }

    if (!showDropdown || suggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) =>
        index < suggestions.length - 1 ? index + 1 : 0,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        index > 0 ? index - 1 : suggestions.length - 1,
      );
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const selected = suggestions[activeIndex];
      if (selected) {
        selectSuggestion(selected);
      }
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: 8,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            pointerEvents: "none",
          }}
        >
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={LINKEDIN_INDUSTRY_MAX_QUERY_LENGTH}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          style={{
            width: "100%",
            padding: "6px 8px 6px 28px",
            border: "1px solid #ddd",
            borderRadius: 4,
            background: disabled ? "#f1f5f9" : "#f8f9fa",
            fontSize: "12px",
            boxSizing: "border-box",
          }}
        />
      </div>

      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #cbd5e1",
            borderRadius: 4,
            boxShadow: "0 4px 12px rgba(15, 23, 42, 0.1)",
            maxHeight: 240,
            overflowY: "auto",
            zIndex: 10060,
          }}
        >
          {isLoading && (
            <div
              style={{
                padding: "8px 10px",
                fontSize: 12,
                color: "#64748b",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  border: "2px solid #0a66c2",
                  borderTopColor: "transparent",
                  animation: "linkedin-industry-spin 0.8s linear infinite",
                }}
                aria-hidden
              />
              Loading industries…
            </div>
          )}

          {!isLoading &&
            suggestions.map((item, index) => {
              const isActive = index === activeIndex;
              return (
                <div
                  key={item.id}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={isActive}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    selectSuggestion(item);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  style={{
                    padding: "8px 10px",
                    fontSize: 12,
                    cursor: "pointer",
                    background: isActive ? "#eff6ff" : "#fff",
                    color: "#333",
                    borderBottom:
                      index < suggestions.length - 1
                        ? "1px solid #f1f5f9"
                        : "none",
                  }}
                >
                  {highlightMatch(item.title, value)}
                </div>
              );
            })}
        </div>
      )}

      <style>{`
        @keyframes linkedin-industry-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
