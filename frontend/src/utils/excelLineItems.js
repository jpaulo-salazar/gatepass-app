/**
 * Excel import/export for gate pass and transmittal line items (bulk rows).
 * Uses the same xlsx library as Product Encoding.
 */
import * as XLSX from 'xlsx';

export const MAX_LINE_ITEMS = 2000;

function normCell(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** First row = headers. Match column by preferred labels. */
function columnIndex(headerRow, labels) {
  const headers = (headerRow || []).map((c) => normCell(c));
  for (const label of labels) {
    const n = normCell(label);
    let i = headers.findIndex((h) => h === n);
    if (i >= 0) return i;
  }
  for (const label of labels) {
    const n = normCell(label);
    const i = headers.findIndex((h) => h.includes(n) || n.includes(h));
    if (i >= 0) return i;
  }
  return -1;
}

function readWorkbookRows(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);
  const wb = XLSX.read(data, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
}

/**
 * @returns {{ items: Array<{item_code: string, item_description: string, qty: number, ref_doc_no: string, destination: string}>, error: string|null }}
 */
export function parseGatePassLineItemsExcel(arrayBuffer) {
  const rows = readWorkbookRows(arrayBuffer);
  if (!rows.length) {
    return { items: [], error: 'The spreadsheet is empty.' };
  }
  const header = rows[0];
  const colCode = columnIndex(header, ['Item Code', 'Item No.', 'Item No']);
  const colDesc = columnIndex(header, ['Item Description', 'Description']);
  const colQty = columnIndex(header, ['Qty', 'Quantity']);
  const colRef = columnIndex(header, ['Ref. Doc No.', 'Ref Doc No', 'Ref. Doc/Invoice No.', 'Invoice No.', 'Ref Doc']);
  const colDest = columnIndex(header, ['Destination']);

  if (colDesc < 0) {
    return {
      items: [],
      error:
        'Missing required column. Use the first row for headers and include "Item Description" (or "Description"). See "Download sample Excel".',
    };
  }

  const items = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const item_description = String(row[colDesc] ?? '').trim();
    if (!item_description) continue;
    const item_code = colCode >= 0 ? String(row[colCode] ?? '').trim() : '';
    const qtyRaw = colQty >= 0 ? row[colQty] : 0;
    const qty = Math.max(0, parseInt(String(qtyRaw ?? '').replace(/,/g, ''), 10) || 0);
    const ref_doc_no = colRef >= 0 ? String(row[colRef] ?? '').trim() : '';
    const destination = colDest >= 0 ? String(row[colDest] ?? '').trim() : '';
    items.push({
      item_code,
      item_description,
      qty,
      ref_doc_no,
      destination,
    });
    if (items.length >= MAX_LINE_ITEMS) break;
  }

  if (items.length === 0) {
    return {
      items: [],
      error: 'No data rows found. Add lines under the header row with at least "Item Description" filled in.',
    };
  }
  return { items, error: null };
}

/**
 * @returns {{ items: Array<{item_description: string, qty: number, ref_doc_no: string, destination: string}>, error: string|null }}
 */
export function parseTransmittalLineItemsExcel(arrayBuffer) {
  const rows = readWorkbookRows(arrayBuffer);
  if (!rows.length) {
    return { items: [], error: 'The spreadsheet is empty.' };
  }
  const header = rows[0];
  const colDesc = columnIndex(header, ['Item Description', 'Description', 'Document']);
  const colQty = columnIndex(header, ['Qty', 'Quantity']);
  const colRef = columnIndex(header, ['Ref. Doc No.', 'Ref Doc No', 'Ref. Doc/Invoice No.', 'Invoice No.', 'Ref Doc']);
  const colDest = columnIndex(header, ['Destination']);

  if (colDesc < 0) {
    return {
      items: [],
      error:
        'Missing required column. First row must include "Item Description" (or "Description"). See "Download sample Excel".',
    };
  }

  const items = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const item_description = String(row[colDesc] ?? '').trim();
    if (!item_description) continue;
    const qtyRaw = colQty >= 0 ? row[colQty] : 0;
    const qty = Math.max(0, parseInt(String(qtyRaw ?? '').replace(/,/g, ''), 10) || 0);
    const ref_doc_no = colRef >= 0 ? String(row[colRef] ?? '').trim() : '';
    const destination = colDest >= 0 ? String(row[colDest] ?? '').trim() : '';
    items.push({ item_description, qty, ref_doc_no, destination });
    if (items.length >= MAX_LINE_ITEMS) break;
  }

  if (items.length === 0) {
    return {
      items: [],
      error: 'No data rows found. Fill in "Item Description" from row 2 downward.',
    };
  }
  return { items, error: null };
}

export function downloadGatePassLineItemsSample() {
  const headers = ['Item Code', 'Item Description', 'Qty', 'Ref. Doc No.', 'Destination'];
  const sample = [
    ['AF-DEMO-01', 'Example air fryer line (replace with your products)', 2, 'INV-2026-001', 'Main warehouse'],
    ['', 'Free-text line without product code', 1, '', 'QC'],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Gate pass items');
  XLSX.writeFile(wb, 'gate-pass-line-items-sample.xlsx');
}

export function downloadTransmittalLineItemsSample() {
  const headers = ['Item Description', 'Qty', 'Ref. Doc No.', 'Destination'];
  const sample = [
    ['Contract bundle — Finance review', 1, 'DOC-100', 'Finance'],
    ['Technical drawings set', 3, 'PKG-44', 'Engineering'],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transmittal items');
  XLSX.writeFile(wb, 'transmittal-line-items-sample.xlsx');
}

/** Product Encoding page — same columns as bulk upload. */
/**
 * If a row has Item Code but empty description, fill from Product Encoding catalog when possible.
 */
export function enrichGatePassItemsFromProducts(items, products) {
  const list = products || [];
  return items
    .map((it) => {
      let item_description = (it.item_description || '').trim();
      const item_code = (it.item_code || '').trim();
      if (!item_description && item_code) {
        const p = list.find((x) => (x.item_code || '').trim() === item_code);
        if (p) item_description = (p.item_description || '').trim();
      }
      return { ...it, item_code, item_description };
    })
    .filter((it) => (it.item_description || '').trim());
}

export function downloadProductEncodingSample() {
  const headers = ['Item No.', 'Item Description', 'Item Group'];
  const sample = [
    ['PRD-SAMPLE-01', 'Example product name', 'Appliances'],
    ['PRD-SAMPLE-02', 'Another row', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  XLSX.writeFile(wb, 'product-encoding-sample.xlsx');
}
