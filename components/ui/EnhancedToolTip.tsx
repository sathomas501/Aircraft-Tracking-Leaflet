// components/shared/ui/EnhancedTooltip.tsx
import React, { useState, useRef, useEffect } from 'react';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: 'top' | 'right' | 'bottom' | 'left';
  delay?: number;
  className?: string;
  contentClassName?: string;
  offset?: number;
  maxWidth?: number;
  isInteractive?: boolean;
}

const EnhancedTooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 300,
  className = '',
  contentClassName = '',
  offset = 10,
  maxWidth = 250,
  isInteractive = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Position calculation based on target element and selected position
  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = triggerRect.top + scrollY - tooltipRect.height - offset;
        left =
          triggerRect.left +
          scrollX +
          (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'right':
        top =
          triggerRect.top +
          scrollY +
          (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + scrollX + offset;
        break;
      case 'bottom':
        top = triggerRect.bottom + scrollY + offset;
        left =
          triggerRect.left +
          scrollX +
          (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top =
          triggerRect.top +
          scrollY +
          (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left + scrollX - tooltipRect.width - offset;
        break;
    }

    // Ensure tooltip stays within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < scrollX) left = scrollX + 5;
    if (left + tooltipRect.width > scrollX + viewportWidth)
      left = scrollX + viewportWidth - tooltipRect.width - 5;
    if (top < scrollY) top = scrollY + 5;
    if (top + tooltipRect.height > scrollY + viewportHeight)
      top = scrollY + viewportHeight - tooltipRect.height - 5;

    setTooltipPos({ top, left });
  };

  // Show tooltip
  const showTooltip = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsVisible(true);
      // Calculate position after tooltip is visible and rendered
      setTimeout(calculatePosition, 0);
    }, delay);
  };

  // Hide tooltip
  const hideTooltip = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 100);
  };

  // Recalculate position if window is resized
  useEffect(() => {
    const handleResize = () => {
      if (isVisible) calculatePosition();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
    };
  }, [isVisible]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Handle tooltip hover for interactive tooltips
  const handleTooltipMouseEnter = () => {
    if (isInteractive && timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const handleTooltipMouseLeave = () => {
    if (isInteractive) {
      hideTooltip();
    }
  };

  return (
    <div
      ref={triggerRef}
      className={`inline-block relative ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`fixed z-50 bg-gray-800 text-white rounded px-2 py-1 text-sm shadow-lg pointer-events-none ${
            isInteractive ? 'pointer-events-auto' : ''
          } ${contentClassName}`}
          style={{
            top: tooltipPos.top,
            left: tooltipPos.left,
            maxWidth: `${maxWidth}px`,
          }}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export default EnhancedTooltip;
