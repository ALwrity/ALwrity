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

  // Check for explicit numeric dimensions first
  const numericWidth = typeof width === 'number' ? width : 0;
  const numericHeight = typeof height === 'number' ? height : 0;
  const hasNumericSize = numericWidth > 0 && numericHeight > 0;

  React.useEffect(() => {
    if (hasNumericSize) return; // Skip ResizeObserver if we have numeric dimensions
    
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    
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
  }, [hasNumericSize]);

  // Don't render anything until we have valid dimensions
  if (!hasNumericSize && !hasSize) {
    const containerWidth = typeof width === 'number' ? `${width}px` : width;
    const containerHeight = typeof height === 'number' ? `${height}px` : height;
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

  // Use numeric dimensions if available, otherwise use 100%
  const containerStyle: React.CSSProperties = hasNumericSize 
    ? { width: numericWidth, height: numericHeight }
    : { width: '100%', height: '100%' };

  return (
    <div
      ref={boxRef}
      style={{
        ...containerStyle,
        minWidth: 1,
        minHeight: 1,
      }}
    >
      <ResponsiveContainer 
        width={hasNumericSize ? '100%' : '100%'} 
        height={hasNumericSize ? '100%' : '100%'} 
        {...rest}
      >
        {children}
      </ResponsiveContainer>
    </div>
  );
};

export default SafeResponsiveContainer;
