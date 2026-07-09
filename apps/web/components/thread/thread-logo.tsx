import Image from "next/image";

export function ThreadLogoMark({ size = 28 }: { size?: number }) {
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

export function ThreadWordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const fontSize = size === "sm" ? 12 : size === "lg" ? 17 : 14;
  const gap = size === "lg" ? "0.38em" : size === "sm" ? "0.28em" : "0.34em";

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
