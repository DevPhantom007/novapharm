import React from "react";

export default function NovaLogo({ className = "", title = "Nova Pharm" }) {
  return (
    <svg
      viewBox="0 0 96 96"
      role="img"
      aria-label={title}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <rect x="6" y="6" width="84" height="84" rx="23" fill="#F77A2B" />
      <path
        d="M38 24h20v14h14v20H58v14H38V58H24V38h14V24Z"
        fill="#FFFFFF"
      />
      <path
        d="M59 27c6-11 17-13 24-10-2 10-10 19-22 20-3-2-4-6-2-10Z"
        fill="#168255"
      />
      <path d="M61 34c5-4 10-8 16-10" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
