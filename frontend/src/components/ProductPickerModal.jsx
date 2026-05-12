import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Modal-based searchable picker for products. Built for catalogs with thousands
 * of items: keystroke-debounced filter, virtualized via "show first N" so
 * scrolling stays smooth, keyboard navigation (↑/↓/Enter/Esc).
 */
export default function ProductPickerModal({
  open,
  products,
  usedItemCodes,
  selectedItemCode,
  onSelect,
  onClear,
  onClose,
  initialQuery = '',
  pageSize = 100,
}) {
  const [query, setQuery] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery || '');
      setActiveIndex(0);
      setVisibleCount(pageSize);
      const id = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [open, initialQuery, pageSize]);

  const usedSet = useMemo(() => {
    const s = new Set();
    (usedItemCodes || []).forEach((c) => {
      if (c) s.add(String(c).trim());
    });
    return s;
  }, [usedItemCodes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products || [];
    return (products || []).filter((p) => {
      const code = (p.item_code || '').toLowerCase();
      const desc = (p.item_description || '').toLowerCase();
      return code.includes(q) || desc.includes(q);
    });
  }, [products, query]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visible.length;

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose?.();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(visible.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const p = visible[activeIndex];
      if (p && !usedSet.has((p.item_code || '').trim())) {
        onSelect?.(p);
      }
    }
  }

  useEffect(() => {
    const li = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`);
    if (li && typeof li.scrollIntoView === 'function') {
      li.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  if (!open) return null;

  return (
    <div className="gp-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Select item">
      <div
        className="gp-modal product-picker-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="gp-modal-header">
          <h2>Select item</h2>
          <button type="button" className="gp-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="product-picker-body">
          <div className="product-picker-search-wrap">
            <input
              ref={inputRef}
              type="search"
              className="product-picker-search"
              placeholder="Search by item code or description…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            <div className="product-picker-meta">
              <span>
                {filtered.length.toLocaleString()} of {(products || []).length.toLocaleString()} items
              </span>
              {selectedItemCode && (
                <button
                  type="button"
                  className="product-picker-clear"
                  onClick={() => {
                    onClear?.();
                  }}
                >
                  Clear selection
                </button>
              )}
            </div>
          </div>
          <ul className="product-picker-list" ref={listRef}>
            {visible.length === 0 ? (
              <li className="product-picker-empty">
                No products match your search.
              </li>
            ) : (
              visible.map((p, idx) => {
                const code = (p.item_code || '').trim();
                const isUsed = usedSet.has(code);
                const isSelected = selectedItemCode && code === String(selectedItemCode).trim();
                const isActive = idx === activeIndex;
                return (
                  <li
                    key={p.id ?? `${code}-${idx}`}
                    data-idx={idx}
                    className={
                      'product-picker-item' +
                      (isUsed ? ' is-used' : '') +
                      (isActive ? ' is-active' : '') +
                      (isSelected ? ' is-selected' : '')
                    }
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      if (!isUsed) onSelect?.(p);
                    }}
                  >
                    <div className="product-picker-code">{p.item_code || '—'}</div>
                    <div className="product-picker-desc">{p.item_description || '—'}</div>
                    <div className="product-picker-tags">
                      {isSelected && <span className="product-picker-tag is-selected-tag">Selected</span>}
                      {isUsed && !isSelected && <span className="product-picker-tag is-used-tag">Already added</span>}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
          {hasMore && (
            <div className="product-picker-more">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setVisibleCount((n) => n + pageSize)}
              >
                Show {Math.min(pageSize, filtered.length - visible.length)} more
                <span className="product-picker-more-hint">
                  ({visible.length.toLocaleString()} / {filtered.length.toLocaleString()})
                </span>
              </button>
            </div>
          )}
        </div>
        <div className="product-picker-footer">
          <span className="product-picker-hint">
            ↑/↓ to navigate • Enter to select • Esc to close
          </span>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
