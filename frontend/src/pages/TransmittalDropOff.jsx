import TransmittalOutScanPage from './TransmittalOutScanPage';

/** Same receptionist intake step as Receptionist Scan; for users with the Drop off role only. */
export default function TransmittalDropOff() {
  return (
    <TransmittalOutScanPage
      phase="receptionist"
      pageTitle="Transmittal drop off"
      pageDescription="Look up an approved OUT transmittal and record desk intake. If the recipient was chosen on the transmittal form, only confirm handoff here."
    />
  );
}
