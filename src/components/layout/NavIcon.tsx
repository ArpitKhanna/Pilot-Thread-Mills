export function NavIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const props = {
    className,
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 1.5,
  };

  switch (name) {
    case "grid":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...props}>
          <path d="M3 7h14a2 2 0 012 2v8a2 2 0 01-2 2H3V7z" />
          <path d="M17 11h4v4h-4a2 2 0 010-4z" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...props}>
          <path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3z" />
          <path d="M9 8h6M9 12h6" />
        </svg>
      );
    case "package":
      return (
        <svg {...props}>
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
          <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
        </svg>
      );
    case "list-checks":
      return (
        <svg {...props}>
          <path d="M9 6h10M9 12h10M9 18h10" />
          <path d="M5 6l1 1 2-2M5 12l1 1 2-2M5 18l1 1 2-2" />
        </svg>
      );
    case "palette":
      return (
        <svg {...props}>
          <path d="M12 3a9 9 0 109 9c0-2-1.5-3-3-3h-1.5a1.5 1.5 0 010-3H18a6 6 0 000-12z" />
          <circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
          <circle cx="11" cy="7" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="9" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "users":
      return (
        <svg {...props}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" />
          <circle cx="17" cy="9" r="2" />
          <path d="M21 19c0-2-1.5-3.5-3.5-3.5" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...props}>
          <rect x="3" y="8" width="18" height="12" rx="2" />
          <path d="M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2" />
        </svg>
      );
    case "landmark":
      return (
        <svg {...props}>
          <path d="M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M2 18h20" />
          <path d="M12 3l7 4H5l7-4z" />
        </svg>
      );
    case "tags":
      return (
        <svg {...props}>
          <path d="M3 12l8.5 8.5a2 2 0 002.8 0l6.7-6.7a2 2 0 000-2.8L12.3 3H6a3 3 0 00-3 3v6L3 12z" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "shield":
      return (
        <svg {...props}>
          <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
