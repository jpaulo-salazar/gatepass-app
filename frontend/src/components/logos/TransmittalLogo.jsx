/**
 * Transmittal app logo – documents with send arrow. Use currentColor to inherit text color.
 */
export default function TransmittalLogo({ className, size = 48 }) {
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
      {/* Stacked pages */}
      <rect x="12" y="8" width="18" height="24" rx="1.5" fill="currentColor" opacity="0.25" />
      <rect x="16" y="12" width="18" height="24" rx="1.5" fill="currentColor" opacity="0.45" />
      <rect x="20" y="16" width="18" height="24" rx="1.5" fill="currentColor" opacity="0.7" />
      {/* Arrow right (transmit) */}
      <path
        d="M26 26h10m0 0l-4-4m4 4l-4 4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
