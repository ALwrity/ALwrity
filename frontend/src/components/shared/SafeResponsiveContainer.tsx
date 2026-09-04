import React from 'react';
import { ResponsiveContainer } from '../../utils/lazyRecharts';

type ResponsiveContainerProps = React.ComponentProps<typeof ResponsiveContainer>;

interface SafeResponsiveContainerProps extends Omit<ResponsiveContainerProps, 'children'> {
  children: React.ReactElement;
}

/**
 * SafeResponsiveContainer - drop-in wrapper around recharts' ResponsiveContainer.
 *
 * RCA of the recharts warning "The width(-1) and height(-1) of chart should be
 * greater than 0": recharts 3.x seeds its measured-size state from the
 * `initialDimension` prop, which defaults to { width: -1, height: -1 }. Every
 * ResponsiveContainer therefore warns once on its first render, before its own
 * ResizeObserver reports the real box size. The warning is pure noise for
 * charts that mount/unmount frequently (e.g. AnimatePresence view switches).
 *
 * Fix: measure our own box first and only mount ResponsiveContainer once the
 * box is measurable, passing the real measured size as `initialDimension` so
 * recharts' first render already has positive dimensions.
 *
 * Props are forwarded 1:1 to ResponsiveContainer.
 */
export const SafeResponsiveContainer: React.FC<SafeResponsiveContainerProps> = ({
  width = '100%',
  height = '100%',
  children,
  ...rest
}) => {
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null);

  React.useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const w = Math.round(entry?.contentRect?.width ?? 0);
      const h = Math.round(entry?.contentRect?.height ?? 0);
      setSize((prev) => {
        if (w > 0 && h > 0) {
          return prev && prev.w === w && prev.h === h ? prev : { w, h };
        }
        // Collapsed (e.g. parent exit animation): keep last known size.
        return prev;
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Explicit numeric width AND height: no measurement needed.
  const numericWidth = typeof width === 'number' ? width : 0;
  const numericHeight = typeof height === 'number' ? height : 0;
  const hasFullNumericSize = numericWidth > 0 && numericHeight > 0;

  // Recharts requires positive initialDimension or it warns on first render.
  const initialDimension = hasFullNumericSize
    ? { width: numericWidth, height: numericHeight }
    : size
      ? { width: size.w, height: size.h }
      : { width: 1, height: 1 };

  const shouldRenderChart = hasFullNumericSize || size !== null;

  return (
    <div
      ref={boxRef}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    >
      {shouldRenderChart ? (
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={initialDimension}
          {...rest}
        >
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
};

export default SafeResponsiveContainer;
