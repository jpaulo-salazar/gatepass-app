import TransmittalOutScanPage from './TransmittalOutScanPage';

/**
 * Optional page for the Drop off role: records the same desk-intake step as Receptionist Scan.
 * Receptionist Scan remains the primary reception workflow; assign this role only if you want a separate optional entry point.
 */
export default function TransmittalDropOff() {
  return (
    <TransmittalOutScanPage
      phase="drop_off"
      pageTitle="Drop off (optional)"
      pageDescription="Optional: record a drop-off marker if your site uses a Drop off account. This does not complete receptionist receipt — Receptionist Scan is still the required final step before recipient scan."
    />
  );
}
