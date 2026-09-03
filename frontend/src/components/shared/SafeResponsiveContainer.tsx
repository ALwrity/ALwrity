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
  const [hasSize, setHasSize] = React.useState(false);

  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    // If we have explicit numeric dimensions, we can render immediately
    const numericWidth = typeof width === 'number' ? width : 0;
    const numericHeight = typeof height === 'number' ? height : 0;
    
    if (numericWidth > 0 && numericHeight > 0) {
      setHasSize(true);
      return;
    }

    // Otherwise use ResizeObserver to wait for container to get size
    if (typeof ResizeObserver === 'undefined') return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          setHasSize(true);
          observer.disconnect();
          return;
        }
      }
    });
    
    observer.observe(el);
    return () => observer.disconnect();
  }, [width, height]);

  // Determine container style
  const containerWidth = typeof width === 'number' ? `${width}px` : width;
  const containerHeight = typeof height === 'number' ? `${height}px` : height;

  // Don't render ResponsiveContainer until we have valid dimensions
  if (!hasSize) {
    return (
      <div
        ref={boxRef}
        style={{
          width: containerWidth,
          height: containerHeight,
          minWidth: 1,
          minHeight: 1,
        }}
      />
    );
  }

  return (
    <div
      ref={boxRef}
      style={{
        width: containerWidth,
        height: containerHeight,
        minWidth: 1,
        minHeight: 1,
      }}
    >
      <ResponsiveContainer width="100%" height="100%" {...rest}>
        {children}
      </ResponsiveContainer>
    </div>
  );
};

export default SafeResponsiveContainer;
