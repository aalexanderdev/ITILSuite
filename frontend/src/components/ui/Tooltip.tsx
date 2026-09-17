import React, { useState, useRef, useEffect } from 'react';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: React.ReactNode;
  position?: TooltipPosition;
  delay?: number;
  children: React.ReactNode;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  delay = 150,
  children,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const showTooltip = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!content) {
    return <>{children}</>;
  }

  return (
    <span
      className={`tooltip-wrapper ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <span
          className={`tooltip-bubble tooltip-bubble--${position}`}
          role="tooltip"
          aria-hidden={!isVisible}
        >
          {content}
          <span className={`tooltip-arrow tooltip-arrow--${position}`} />
        </span>
      )}
    </span>
  );
};
