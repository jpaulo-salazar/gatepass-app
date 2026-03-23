/**
 * Gate Pass app logo – gate/checkpoint with check. Use currentColor to inherit text color.
 */
export default function GatePassLogo({ className, size = 48 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Gate posts */}
      <rect x="8" y="12" width="4" height="28" rx="2" fill="currentColor" opacity="0.9" />
      <rect x="36" y="12" width="4" height="28" rx="2" fill="currentColor" opacity="0.9" />
      {/* Crossbar */}
      <rect x="8" y="20" width="32" height="4" rx="2" fill="currentColor" opacity="0.95" />
      {/* Check circle */}
      <circle cx="24" cy="32" r="10" fill="currentColor" opacity="0.25" />
      <path
        d="M20 32l4 4 8-8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
