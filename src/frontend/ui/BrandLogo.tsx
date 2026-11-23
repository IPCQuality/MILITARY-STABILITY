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
            ? 'fill-white stroke-teal-200 dark:fill-[#1D222B] dark:stroke-zinc-700'
            : 'fill-teal-700 stroke-transparent dark:fill-teal-700 dark:stroke-teal-600/40'
        }
        strokeWidth="1"
      />
      <path
        d="M8 21V11L13.5 17L19 11V21"
        className={
          isLight
            ? 'stroke-teal-700 dark:stroke-zinc-100'
            : 'stroke-white dark:stroke-white'
        }
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21.5 21H24.5"
        className={
          isLight
            ? 'stroke-teal-600 dark:stroke-dark-accent'
            : 'stroke-teal-200 dark:stroke-teal-200'
        }
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
