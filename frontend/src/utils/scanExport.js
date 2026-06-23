import { formatIsoDateTimeDisplay } from './dateTime';

function formatExportDateTime(value) {
  const s = formatIsoDateTimeDisplay(value);
  return s === '—' ? '' : s;
}

export function allReleaseBarcodeScansForExport(scanEvents) {
  const evs = (scanEvents || []).filter((e) => e.event_type === 'release_barcode_scan');
  if (evs.length === 0) {
    return [];
  }
  return evs.map((ev) => ({
    scanAt: formatExportDateTime(ev.created_at),
    scannedBy: (ev.user_full_name || '').trim(),
    intransit: (ev.intransit || '').trim(),
  }));
}

export function releaseBarcodeScanForExport(scanEvents) {
  const all = allReleaseBarcodeScansForExport(scanEvents);
  if (all.length === 0) {
    return { scanAt: '', scannedBy: '', intransit: '' };
  }
  return all[all.length - 1];
}
