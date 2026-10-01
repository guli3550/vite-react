import React from "react";
import type { SocialPlatform } from "../../types/socialPromo";

export const InstagramLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 22,
  className = "",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}
    aria-label="Instagram"
  >
    <defs>
      <linearGradient id="guli_ig_grad" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fdf497" />
        <stop offset="5%" stopColor="#fdf497" />
        <stop offset="45%" stopColor="#fd5949" />
        <stop offset="60%" stopColor="#d6249f" />
        <stop offset="90%" stopColor="#285AEB" />
      </linearGradient>
    </defs>
    <rect width="24" height="24" rx="6.5" fill="url(#guli_ig_grad)" />
    <rect x="5.5" y="5.5" width="13" height="13" rx="3.5" stroke="#ffffff" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="3.2" stroke="#ffffff" strokeWidth="1.8" />
    <circle cx="16.3" cy="7.7" r="0.9" fill="#ffffff" />
  </svg>
);

export const TelegramLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 22,
  className = "",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}
    aria-label="Telegram"
  >
    <defs>
      <linearGradient id="guli_tg_grad" x1="12" y1="0" x2="12" y2="24" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2AABEE" />
        <stop offset="100%" stopColor="#229ED9" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="12" fill="url(#guli_tg_grad)" />
    <path
      d="M18.1 6.5L3.8 12C2.8 12.4 2.8 13 3.6 13.2L7.3 14.3L15.8 9C16.2 8.7 16.6 8.9 16.3 9.2L9.4 15.4L9.1 19.4C9.5 19.4 9.7 19.2 9.9 19L12 17L16.3 20.2C17.1 20.6 17.6 20.4 17.8 19.4L20.6 6.2C20.9 5 20.2 4.5 18.1 6.5Z"
      fill="#ffffff"
    />
  </svg>
);

export const YouTubeLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 22,
  className = "",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}
    aria-label="YouTube"
  >
    <rect width="24" height="24" rx="6" fill="#FF0000" />
    <path
      d="M19.6 7.4C19.4 6.5 18.7 5.8 17.8 5.6C16.2 5.2 12 5.2 12 5.2C12 5.2 7.8 5.2 6.2 5.6C5.3 5.8 4.6 6.5 4.4 7.4C4 9 4 12 4 12C4 12 4 15 4.4 16.6C4.6 17.5 5.3 18.2 6.2 18.4C7.8 18.8 12 18.8 12 18.8C12 18.8 16.2 18.8 17.8 18.4C18.7 18.2 19.4 17.5 19.6 16.6C20 15 20 12 20 12C20 12 20 9 19.6 7.4Z"
      fill="#FF0000"
    />
    <polygon points="10,9 15.5,12 10,15" fill="#ffffff" />
  </svg>
);

export const CustomLinkLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 22,
  className = "",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}
    aria-label="Link"
  >
    <circle cx="12" cy="12" r="12" fill="linear-gradient(135deg, #e11d48, #be123c)" />
    <path
      d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
      stroke="#ffffff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
      stroke="#ffffff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const PlatformLogoRenderer: React.FC<{
  platform: SocialPlatform;
  logoUrl?: string | null;
  size?: number;
}> = ({ platform, logoUrl, size = 22 }) => {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={platform}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          border: "1px solid rgba(225, 29, 72, 0.2)",
        }}
        onError={(e) => {
          // Fallback to platform SVG on error
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }

  switch (platform) {
    case "instagram":
      return <InstagramLogo size={size} />;
    case "telegram":
      return <TelegramLogo size={size} />;
    case "youtube":
      return <YouTubeLogo size={size} />;
    default:
      return <CustomLinkLogo size={size} />;
  }
};
