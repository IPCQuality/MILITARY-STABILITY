interface BrandLogoProps {
  size?: number;
  variant?: 'navy' | 'light';
  className?: string;
}

export function BrandLogo({
  size = 28,
  variant = 'navy',
  className = '',
}: BrandLogoProps) {
  const isLight = variant === 'light';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <rect
        width="32"
        height="32"
        rx="8"
        fill={isLight ? '#FFFFFF' : '#0F294A'}
      />
      <path
        d="M8 21V11L13.5 17L19 11V21"
        stroke={isLight ? '#0F294A' : '#FFFFFF'}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21.5 21H24.5"
        stroke={isLight ? '#0F766E' : '#2DD4BF'}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
