import React, { useState } from 'react';

function buildCsv(rows) {
  const headers = ['Date of Production', 'Production Title/Featured Talent', 'Editor Name', 'Intended Exhibition', 'Video Link', 'Song/Track Name/Number', 'Duration', 'Usage', 'Composer(s)', 'Publisher(s)', 'PRO Affiliation', 'Shares %'];
  const csvRows = [headers.join(',')];
  rows
    .slice()
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .forEach((e) => {
      const row = [e.date, e.production, e.editor_name, e.exhibition, e.link, e.track, e.duration, e.usage, e.composers, e.publishers, e.pro, e.shares];
      csvRows.push(row.map((v) => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','));
    });
  return csvRows.join('\n');
}

function download(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportModal({ entries, editors, projects, onClose }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [checkedProjects, setCheckedProjects] = useState([]);
  const [checkedEditors, setCheckedEditors] = useState([]);

  function toggle(list, setList, value) {
    setList((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function handleExport() {
    let rows = entries.slice();
    if (dateFrom) rows = rows.filter((e) => e.date && e.date >= dateFrom);
    if (dateTo) rows = rows.filter((e) => e.date && e.date <= dateTo);
    if (checkedProjects.length) rows = rows.filter((e) => checkedProjects.includes(e.production));
    if (checkedEditors.length) rows = rows.filter((e) => checkedEditors.includes(e.editor_name));

    if (rows.length === 0) {
      alert('No tracks match that filter — nothing to export.');
      return;
    }

    const bits = [];
    if (dateFrom || dateTo) bits.push(`${dateFrom || 'start'}_to_${dateTo || 'now'}`);
    if (checkedProjects.length) bits.push(checkedProjects.length === 1 ? checkedProjects[0].replace(/[^a-z0-9]+/gi, '-').slice(0, 30) : `${checkedProjects.length}-projects`);
    if (checkedEditors.length) bits.push(checkedEditors.length === 1 ? checkedEditors[0].replace(/[^a-z0-9]+/gi, '-') : `${checkedEditors.length}-editors`);
    const filename = bits.length ? `cue-sheet-export_${bits.join('_')}.csv` : 'cue-sheet-export.csv';

    download(buildCsv(rows), filename);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Export CSV</h2>
        <p className="modal-hint">Leave everything unchecked / blank to export the whole tracker.</p>

        <div className="modal-section">
          <label className="modal-section-label">Date range</label>
          <div className="daterange">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <span>to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className="modal-section">
          <label className="modal-section-label">Projects</label>
          <div className="checklist">
            {projects.length === 0 ? (
              <div className="empty-note">None logged yet</div>
            ) : (
              projects.map((p) => (
                <label key={p}>
                  <input type="checkbox" checked={checkedProjects.includes(p)} onChange={() => toggle(checkedProjects, setCheckedProjects, p)} />
                  {p}
                </label>
              ))
            )}
          </div>
        </div>

        <div className="modal-section">
          <label className="modal-section-label">Editors</label>
          <div className="checklist">
            {editors.length === 0 ? (
              <div className="empty-note">None logged yet</div>
            ) : (
              editors.map((ed) => (
                <label key={ed}>
                  <input type="checkbox" checked={checkedEditors.includes(ed)} onChange={() => toggle(checkedEditors, setCheckedEditors, ed)} />
                  {ed}
                </label>
              ))
            )}
          </div>
        </div>

        <div className="panel-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleExport}>Export CSV</button>
        </div>
      </div>
    </div>
  );
}
