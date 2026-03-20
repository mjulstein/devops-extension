interface PinIconProps {
  isPinned: boolean;
  className: string;
}

export function PinIcon({ isPinned, className }: PinIconProps) {
  return isPinned ? (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M5 2.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.1c0 .5.2 1 .55 1.35l.85.85a.75.75 0 0 1-.53 1.28H9.5v3.35l1.12 1.12a.75.75 0 1 1-1.06 1.06L8 11.06l-1.56 1.56a.75.75 0 1 1-1.06-1.06L6.5 10.44V7.1H4.13A.75.75 0 0 1 3.6 5.82l.85-.85c.35-.35.55-.84.55-1.34V2.5Z" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinejoin="round"
    >
      <path d="M5 2.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.1c0 .5.2 1 .55 1.35l.85.85a.75.75 0 0 1-.53 1.28H9.5v3.35l1.12 1.12a.75.75 0 1 1-1.06 1.06L8 11.06l-1.56 1.56a.75.75 0 1 1-1.06-1.06L6.5 10.44V7.1H4.13A.75.75 0 0 1 3.6 5.82l.85-.85c.35-.35.55-.84.55-1.34V2.5Z" />
    </svg>
  );
}
