import React from 'react';
import { ResponsiveContainer } from '../../utils/lazyRecharts';

type ResponsiveContainerProps = React.ComponentProps<typeof ResponsiveContainer>;

interface SafeResponsiveContainerProps extends Omit<ResponsiveContainerProps, 'children'> {
  children: React.ReactElement;
}

/**
 * SafeResponsiveContainer - drop-in wrapper around recharts' ResponsiveContainer
 * that only mounts the chart once its container is actually measurable.
 *
 * Why: charts rendered inside AnimatePresence transitions (e.g. billing
 * dashboard card switches) have a parent that collapses to width/height -1
 * during exit animations, and recharts logs
 * "The width(-1) and height(-1) of chart should be greater than 0" on every
 * frame. This wrapper hides the chart until the wrapper box has a real size,
 * then mounts ResponsiveContainer with 100%/100% against the sized box.
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
  const [measurable, setMeasurable] = React.useState(false);

  React.useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const w = entry?.contentRect?.width ?? 0;
      const h = entry?.contentRect?.height ?? 0;
      setMeasurable(w > 0 && h > 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={boxRef}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        minWidth: 1,
        minHeight: 1,
      }}
    >
      {measurable ? (
        <ResponsiveContainer width="100%" height="100%" {...rest}>
          {children}
        </ResponsiveContainer>
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
      )}
    </div>
  );
};

export default SafeResponsiveContainer;
