import React from "react";
import { useConnectLockedHint } from "../../hooks/useConnectLockedHint";

interface ConnectLockedHintBubbleProps {
  visible: boolean;
  hint: string;
  placement?: "top" | "bottom";
}

export const ConnectLockedHintBubble: React.FC<
  ConnectLockedHintBubbleProps
> = ({ visible, hint, placement = "top" }) => {
  if (!visible) return null;

  return (
    <span
      className={[
        "linkedin-connect-locked-hint",
        placement === "bottom" && "linkedin-connect-locked-hint--bottom",
      ]
        .filter(Boolean)
        .join(" ")}
      role="tooltip"
    >
      <span className="linkedin-connect-locked-hint__text">{hint}</span>
    </span>
  );
};

interface ConnectLockedSurfaceProps {
  hint?: string;
  placement?: "top" | "bottom";
  className?: string;
  children: React.ReactElement;
}

/** Wraps a locked control — shows hint on hover/focus; flash on click. */
export const ConnectLockedSurface: React.FC<ConnectLockedSurfaceProps> = ({
  hint,
  placement = "top",
  className,
  children,
}) => {
  const { hintVisible, revealHint, concealHint, flashHint } =
    useConnectLockedHint(true);

  return (
    <span
      className={["linkedin-connect-locked-surface", className]
        .filter(Boolean)
        .join(" ")}
      onMouseEnter={revealHint}
      onMouseLeave={concealHint}
    >
      {React.cloneElement(children, {
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          flashHint();
          children.props.onClick?.(event);
        },
        onFocus: (event: React.FocusEvent<HTMLElement>) => {
          revealHint();
          children.props.onFocus?.(event);
        },
        onBlur: (event: React.FocusEvent<HTMLElement>) => {
          concealHint();
          children.props.onBlur?.(event);
        },
      })}
      <ConnectLockedHintBubble
        visible={hintVisible}
        hint={
          hint ??
          children.props.title ??
          children.props["aria-label"] ??
          "Connect LinkedIn to unlock"
        }
        placement={placement}
      />
    </span>
  );
};
