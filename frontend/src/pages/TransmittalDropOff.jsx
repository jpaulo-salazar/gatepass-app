import TransmittalOutScanPage from './TransmittalOutScanPage';

/**
 * Optional page for the Drop off role: records the same desk-intake step as Receptionist Scan.
 * Receptionist Scan remains the primary reception workflow; assign this role only if you want a separate optional entry point.
 */
export default function TransmittalDropOff() {
  return (
    <TransmittalOutScanPage
      phase="receptionist"
      pageTitle="Drop off (optional)"
      pageDescription="Optional: record desk intake here if your site uses a Drop off account. The main reception flow is still Receptionist Scan — this does not replace it. Look up an approved OUT transmittal and confirm handoff; if the recipient was set on the transmittal form, only confirm intake."
    />
  );
}
