import Image from "next/image";

export function ThreadLogoMark({ size = 28 }: Readonly<{ size?: number }>) {
  return (
    <Image
      src="/thread-logo.svg"
      alt="MailOS"
      width={size}
      height={size}
      style={{ width: size, height: size, flexShrink: 0 }}
      priority
    />
  );
}

const WORDMARK_LETTERS = ["M", "A", "I", "L", "O", "S"] as const;
const FONT_SIZES = { sm: 12, md: 14, lg: 17 } as const;
const GAPS = { sm: "0.28em", md: "0.34em", lg: "0.38em" } as const;

export function ThreadWordmark({ size = "md" }: Readonly<{ size?: "sm" | "md" | "lg" }>) {
  const fontSize = FONT_SIZES[size];
  const gap = GAPS[size];

  return (
    <span
      className="thread-wordmark"
      style={{
        fontSize,
        fontWeight: 400,
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        gap,
      }}
      aria-label="MAILOS"
    >
      {WORDMARK_LETTERS.map((letter) => (
        <span
          key={letter}
          style={{
            fontWeight: 400,
            lineHeight: 1,
          }}
        >
          {letter}
        </span>
      ))}
    </span>
  );
}

export function GithubIcon({
  size = 16,
  className,
  style,
}: Readonly<{
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}
