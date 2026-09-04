import React, { useMemo, useState } from 'react';
import ExportModal from './ExportModal.jsx';

const COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'production', label: 'Production' },
  { key: 'editor_name', label: 'Editor' },
  { key: 'exhibition', label: 'Exhibition' },
  { key: 'link', label: 'Content Link' },
  { key: 'track', label: 'Track' },
  { key: 'duration', label: 'Duration' },
  { key: 'usage', label: 'Usage' },
  { key: 'composers', label: 'Composer(s)' },
  { key: 'publishers', label: 'Publisher(s)' },
  { key: 'pro', label: 'PRO' },
  { key: 'shares', label: 'Shares' },
];

function esc(s) {
  return s == null ? '' : String(s);
}

export default function TrackerTab({ entries, onEdit, onDelete, onAddLink }) {
  const [search, setSearch] = useState('');
  const [editorFilter, setEditorFilter] = useState('');
  const [missingLinkOnly, setMissingLinkOnly] = useState(false);
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [exportOpen, setExportOpen] = useState(false);

  const editors = useMemo(
    () => [...new Set(entries.map((e) => e.editor_name).filter(Boolean))].sort(),
    [entries]
  );
  const projects = useMemo(
    () => [...new Set(entries.map((e) => e.production).filter(Boolean))].sort(),
    [entries]
  );

  function toggleSort(col) {
    if (sortColumn === col) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  }

  const rows = useMemo(() => {
    let r = [...entries];
    const dir = sortDirection === 'asc' ? 1 : -1;
    r.sort((a, b) => {
      const av = esc(a[sortColumn]);
      const bv = esc(b[sortColumn]);
      if (sortColumn === 'shares') {
        const an = parseFloat(av), bn = parseFloat(bv);
        if (!isNaN(an) && !isNaN(bn)) return (an - bn) * dir;
      }
      return av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
    if (editorFilter) r = r.filter((e) => e.editor_name === editorFilter);
    if (missingLinkOnly) r = r.filter((e) => !e.link);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(
        (e) =>
          esc(e.production).toLowerCase().includes(q) ||
          esc(e.track).toLowerCase().includes(q) ||
          esc(e.editor_name).toLowerCase().includes(q) ||
          esc(e.composers).toLowerCase().includes(q)
      );
    }
    return r;
  }, [entries, sortColumn, sortDirection, editorFilter, missingLinkOnly, search]);

  async function handleDelete(id) {
    if (!window.confirm("Delete this entry? This can't be undone.")) return;
    await onDelete(id);
  }

  async function handleAddLink(entry) {
    const link = window.prompt(`Content link for "${entry.track}":`, '');
    if (link === null || !link.trim()) return;
    await onAddLink(entry.id, link.trim());
  }

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <input
            type="text"
            placeholder="Search production, track, editor…"
            style={{ width: 240 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={editorFilter} onChange={(e) => setEditorFilter(e.target.value)}>
            <option value="">All editors</option>
            {editors.map((ed) => (
              <option key={ed} value={ed}>{ed}</option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-soft)', cursor: 'pointer' }}>
            <input type="checkbox" checked={missingLinkOnly} onChange={(e) => setMissingLinkOnly(e.target.checked)} />
            Missing link only
          </label>
        </div>
        <button onClick={() => setExportOpen(true)}>Export CSV</button>
      </div>

      <table>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} data-sort={c.key} onClick={() => toggleSort(c.key)} className={sortColumn === c.key ? 'sorted' : ''}>
                {c.label}
                {sortColumn === c.key && <span className="sort-arrow">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>}
              </th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length + 1}>
                <div className="empty">{entries.length === 0 ? 'No tracks logged yet. Use the Log tab to add the first one.' : 'Nothing matches that search.'}</div>
              </td>
            </tr>
          ) : (
            rows.map((e) => (
              <tr key={e.id} className={e.pro === 'SESAC' ? 'sesac' : ''}>
                <td data-label="Date">{esc(e.date)}</td>
                <td data-label="Production">{esc(e.production)}</td>
                <td data-label="Editor">{esc(e.editor_name)}</td>
                <td data-label="Exhibition">{esc(e.exhibition)}</td>
                <td data-label="Content Link" style={{ maxWidth: 180 }}>
                  {e.link ? (
                    <a href={e.link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.link}
                    </a>
                  ) : (
                    <span className="needs-link">needs link</span>
                  )}
                </td>
                <td data-label="Track">{esc(e.track)}</td>
                <td data-label="Duration">{esc(e.duration)}</td>
                <td data-label="Usage">{esc(e.usage)}</td>
                <td data-label="Composer(s)">{esc(e.composers)}</td>
                <td data-label="Publisher(s)">{esc(e.publishers)}</td>
                <td data-label="PRO"><span className={`pro-tag${e.pro === 'SESAC' ? ' sesac' : ''}`}>{esc(e.pro)}</span></td>
                <td data-label="Shares">{esc(e.shares)}</td>
                <td>
                  <div className="row-actions">
                    {!e.link && <button className="ghost" onClick={() => handleAddLink(e)}>Add link</button>}
                    <button className="ghost" onClick={() => onEdit(e)}>Edit</button>
                    <button className="ghost" onClick={() => handleDelete(e.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="count-line">Showing {rows.length} of {entries.length}</div>

      {exportOpen && (
        <ExportModal entries={entries} editors={editors} projects={projects} onClose={() => setExportOpen(false)} />
      )}
    </div>
  );
}
