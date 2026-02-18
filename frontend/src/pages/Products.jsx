import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { getProducts, createProduct, createProductsBulk, updateProduct, deleteProduct } from '../api';
import './Encoding.css';

const EXCEL_HEADERS = { itemNo: 'Item No.', itemDesc: 'Item Description', itemGroup: 'Item Group' };

export default function Products() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [inlineForm, setInlineForm] = useState({ item_code: '', item_description: '', item_group: '' });
  const [form, setForm] = useState({ item_code: '', item_description: '', item_group: '' });
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await getProducts();
      setList(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ item_code: '', item_description: '', item_group: '' });
  }

  function openEdit(product) {
    setEditingId(product.id);
    setInlineForm({ item_code: product.item_code, item_description: product.item_description, item_group: product.item_group || '' });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await createProduct(form);
      await load();
      setForm({ item_code: '', item_description: '', item_group: '' });
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleInlineSave() {
    if (!editingId) return;
    setError('');
    try {
      await updateProduct(editingId, inlineForm);
      await load();
      setEditingId(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this product?')) return;
    setError('');
    try {
      await deleteProduct(id);
      await load();
      if (editingId === id) {
        setEditingId(null);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: 'array' });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
          if (!rows.length) {
            resolve([]);
            return;
          }
          const header = rows[0].map((c) => String(c || '').trim());
          const colItemNo = header.findIndex((h) => h === EXCEL_HEADERS.itemNo);
          const colItemDesc = header.findIndex((h) => h === EXCEL_HEADERS.itemDesc);
          const colItemGroup = header.findIndex((h) => h === EXCEL_HEADERS.itemGroup);
          if (colItemNo < 0 || colItemDesc < 0) {
            reject(new Error('Excel must have columns "Item No." and "Item Description".'));
            return;
          }
          const items = [];
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i] || [];
            const item_code = String(row[colItemNo] ?? '').trim();
            const item_description = String(row[colItemDesc] ?? '').trim();
            if (!item_code && !item_description) continue;
            if (!item_code || !item_description) continue;
            items.push({
              item_code,
              item_description,
              item_group: colItemGroup >= 0 ? String(row[colItemGroup] ?? '').trim() || null : null,
            });
          }
          resolve(items);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  async function handleExcelUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploadResult(null);
    setUploading(true);
    try {
      const items = await parseExcelFile(file);
      if (items.length === 0) {
        setError('No valid rows found. Need "Item No." and "Item Description" columns with data.');
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      const result = await createProductsBulk(items);
      setUploadResult(result);
      await load();
    } catch (err) {
      setError(err.message || 'Excel upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const searchLower = search.trim().toLowerCase();
  const filteredList = searchLower
    ? list.filter((p) => {
        const code = (p.item_code || '').toLowerCase();
        const desc = (p.item_description || '').toLowerCase();
        const group = (p.item_group || '').toLowerCase();
        return code.includes(searchLower) || desc.includes(searchLower) || group.includes(searchLower);
      })
    : list;

  if (loading) return <div className="encoding-loading">Loading products…</div>;

  return (
    <div className="encoding-page">
      <h1>Product Encoding</h1>
      <p className="encoding-desc">Manage item no., description, and group for gate pass line items.</p>
      {error && <div className="encoding-error">{error}</div>}
      {uploadResult && (
        <div className="encoding-upload-result">
          Upload complete: <strong>{uploadResult.created}</strong> created, <strong>{uploadResult.skipped}</strong> skipped (duplicate Item No.).
          {uploadResult.skipped_codes?.length > 0 && (
            <span className="encoding-skipped-codes"> Skipped: {uploadResult.skipped_codes.slice(0, 10).join(', ')}
              {uploadResult.skipped_codes.length > 10 ? ` and ${uploadResult.skipped_codes.length - 10} more` : ''}.</span>
          )}
        </div>
      )}
      <div className="encoding-actions">
        <button type="button" onClick={openCreate} className="btn-primary">Add Product</button>
        <label className="btn-secondary encoding-upload-label">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleExcelUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
          {uploading ? 'Uploading…' : 'Upload Excel'}
        </label>
      </div>
      <p className="encoding-excel-hint">Excel format: first row headers <strong>Item No.</strong>, <strong>Item Description</strong>, <strong>Item Group</strong>. Data from row 2.</p>
      <div className="list-search-wrap">
        <input
          type="search"
          className="list-search-input"
          placeholder="Search by Item No., description, or group..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search products"
        />
        {search && (
          <span className="list-search-hint">{filteredList.length} of {list.length}</span>
        )}
      </div>
      <div className="encoding-grid">
        <div className="encoding-list">
          <table className="encoding-table">
            <thead>
              <tr>
                <th>Item No.</th>
                <th>Item Description</th>
                <th>Item Group</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((p) => (
                <tr key={p.id} className={editingId === p.id ? 'editing' : ''}>
                  {editingId === p.id ? (
                    <>
                      <td>
                        <input
                          className="encoding-inline-input"
                          value={inlineForm.item_code}
                          onChange={(e) => setInlineForm((f) => ({ ...f, item_code: e.target.value }))}
                          placeholder="Item No."
                        />
                      </td>
                      <td>
                        <input
                          className="encoding-inline-input"
                          value={inlineForm.item_description}
                          onChange={(e) => setInlineForm((f) => ({ ...f, item_description: e.target.value }))}
                          placeholder="Item Description"
                        />
                      </td>
                      <td>
                        <input
                          className="encoding-inline-input"
                          value={inlineForm.item_group}
                          onChange={(e) => setInlineForm((f) => ({ ...f, item_group: e.target.value }))}
                          placeholder="Item Group"
                        />
                      </td>
                      <td className="encoding-actions-cell">
                        <button type="button" onClick={handleInlineSave} className="btn-sm btn-primary-sm">Save</button>
                        <button type="button" onClick={cancelEdit} className="btn-sm">Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{p.item_code}</td>
                      <td>{p.item_description}</td>
                      <td>{p.item_group || '—'}</td>
                      <td className="encoding-actions-cell">
                        <button type="button" onClick={() => openEdit(p)} className="btn-sm">Edit</button>
                        <button type="button" onClick={() => handleDelete(p.id)} className="btn-sm btn-danger">Delete</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="encoding-form-panel">
          <h2>New Product</h2>
          <form onSubmit={handleSubmit}>
            <label>Item No. *</label>
            <input
              value={form.item_code}
              onChange={(e) => setForm({ ...form, item_code: e.target.value })}
              placeholder="e.g. AC.CF-COOL1"
              required
            />
            <label>Item Description *</label>
            <input
              value={form.item_description}
              onChange={(e) => setForm({ ...form, item_description: e.target.value })}
              required
            />
            <label>Item Group</label>
            <input
              value={form.item_group}
              onChange={(e) => setForm({ ...form, item_group: e.target.value })}
              placeholder="e.g. AIR COOLER, AUTO EQUIPMENT"
            />
            <div className="form-actions">
              <button type="submit" className="btn-primary">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
