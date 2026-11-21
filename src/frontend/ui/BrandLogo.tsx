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
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="7.5"
        className={
          isLight
            ? 'fill-white stroke-teal-200 dark:fill-[#13171D] dark:stroke-teal-400/30'
            : 'fill-teal-700 stroke-transparent dark:fill-[#13171D] dark:stroke-teal-500/35'
        }
        strokeWidth="1"
      />
      <path
        d="M8 21V11L13.5 17L19 11V21"
        className={
          isLight
            ? 'stroke-teal-700 dark:stroke-zinc-100'
            : 'stroke-white dark:stroke-zinc-100'
        }
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21.5 21H24.5"
        className={
          isLight
            ? 'stroke-teal-500 dark:stroke-teal-400'
            : 'stroke-teal-300 dark:stroke-teal-400'
        }
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
