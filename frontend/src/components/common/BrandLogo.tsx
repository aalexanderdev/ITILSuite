import React from 'react';

interface BrandLogoProps {
  variant?: 'full' | 'mark';
  height?: number;
  className?: string;
  color?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'full',
  height = 24,
  className = '',
  color = '#EB4D3D',
}) => {
  if (variant === 'mark') {
    // 1:1 Aspect Ratio (Isotype only)
    const width = Math.round(height * 0.9);
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 50 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`brand-logo-mark ${className}`}
        aria-label="ITILSuite Icon"
      >
        {/* Left Wireframe Face */}
        <polygon
          points="8,12 25,6 25,54 8,48"
          fill="none"
          stroke={color}
          strokeWidth="3.2"
          strokeLinejoin="round"
        />
        {/* Right Solid Face */}
        <polygon
          points="25,6 42,12 42,48 25,54"
          fill={color}
          stroke={color}
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Full Variant: Isotype [I] + "TILSUITE" wordmark
  // Aspect ratio: ~4.5 : 1
  const width = Math.round(height * 4.6);

  return (
    <div className={`brand-logo-container flex items-center ${className}`} style={{ height }}>
      <svg
        height={height}
        width={width}
        viewBox="0 0 280 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="brand-logo-svg"
        aria-label="ITILSuite"
      >
        {/* 3D Isometric Monolith "I" */}
        <g transform="translate(6, 0)">
          {/* Left Wireframe Face */}
          <polygon
            points="10,12 28,6 28,54 10,48"
            fill="none"
            stroke={color}
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
          {/* Right Solid Face */}
          <polygon
            points="28,6 46,12 46,48 28,54"
            fill={color}
            stroke={color}
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </g>

        {/* Slanted Bold Condensed Wordmark "TILSUITE" */}
        <text
          x="60"
          y="49"
          fill={color}
          fontFamily="'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="47"
          fontWeight="900"
          fontStyle="italic"
          letterSpacing="0.01em"
          style={{ fontStretch: 'condensed' }}
        >
          TILSUITE
        </text>
      </svg>
    </div>
  );
};
