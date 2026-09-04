import React, { useState, useRef } from 'react';
import { readAudioTags, extractPublisherAndPro } from '../lib/id3.js';

const DEFAULT_EXHIBITION = 'Socials / Playboy.com';

function formatShare(pct) {
  const v = Math.round(pct * 100) / 100;
  return (Number.isInteger(v) ? v.toString() : v.toFixed(2)) + '%';
}

function emptyTrack() {
  return {
    id: crypto.randomUUID(),
    track: '',
    usage: 'Instrumental',
    pro: '',
    shares: '100%',
    sharesTouched: false,
    composers: '',
    publishers: '',
    uploadStatus: '',
  };
}

function emptyProject(editorEmail, lastComposer, lastPublisher) {
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString().slice(0, 10),
    production: '',
    editor: editorEmail,
    exhibition: DEFAULT_EXHIBITION,
    exhibitionEditing: false,
    link: '',
    duration: '',
    tracks: [{ ...emptyTrack(), composers: lastComposer, publishers: lastPublisher }],
  };
}

function rebalance(tracks) {
  const n = tracks.length;
  const equal = formatShare(100 / n);
  return tracks.map((t) => (t.sharesTouched ? t : { ...t, shares: equal }));
}

export default function LogTab({ session, onSaved, editingEntry, onCancelEdit, showToast }) {
  const editorEmail = session.user.email;
  const [lastComposer, setLastComposer] = useState('');
  const [lastPublisher, setLastPublisher] = useState('');
  const [projects, setProjects] = useState(() =>
    editingEntry ? [projectFromEntry(editingEntry)] : [emptyProject(editorEmail, '', '')]
  );
  const [saving, setSaving] = useState(false);
  const fileInputRefs = useRef({});

  function projectFromEntry(entry) {
    return {
      id: crypto.randomUUID(),
      date: entry.date || new Date().toISOString().slice(0, 10),
      production: entry.production,
      editor: entry.editor_email,
      exhibition: entry.exhibition || DEFAULT_EXHIBITION,
      exhibitionEditing: entry.exhibition !== DEFAULT_EXHIBITION,
      link: entry.link || '',
      duration: entry.duration || '',
      tracks: [{
        id: crypto.randomUUID(),
        track: entry.track,
        usage: entry.usage || 'Instrumental',
        pro: entry.pro || '',
        shares: entry.shares || '',
        sharesTouched: true,
        composers: entry.composers || '',
        publishers: entry.publishers || '',
        uploadStatus: '',
      }],
    };
  }

  const isEditing = !!editingEntry;

  function updateProject(pid, patch) {
    setProjects((prev) => prev.map((p) => (p.id === pid ? { ...p, ...patch } : p)));
  }

  function updateTrack(pid, tid, patch) {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== pid) return p;
        const tracks = p.tracks.map((t) => (t.id === tid ? { ...t, ...patch } : t));
        return { ...p, tracks: patch.sharesTouched !== undefined || 'shares' in patch ? tracks : rebalance(tracks) };
      })
    );
  }

  function addProject() {
    setProjects((prev) => [...prev, emptyProject(editorEmail, lastComposer, lastPublisher)]);
  }

  function removeProject(pid) {
    setProjects((prev) => prev.filter((p) => p.id !== pid));
  }

  function addTrack(pid) {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== pid) return p;
        const tracks = rebalance([...p.tracks, { ...emptyTrack(), composers: lastComposer, publishers: lastPublisher }]);
        return { ...p, tracks };
      })
    );
  }

  function removeTrack(pid, tid) {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== pid) return p;
        const tracks = rebalance(p.tracks.filter((t) => t.id !== tid));
        return { ...p, tracks };
      })
    );
  }

  async function handleFiles(pid, tid, files) {
    const fileArr = Array.from(files || []);
    if (fileArr.length === 0) return;
    const [first, ...rest] = fileArr;
    await fillTrackFromFile(pid, tid, first);
    for (const f of rest) {
      const newId = crypto.randomUUID();
      setProjects((prev) =>
        prev.map((p) =>
          p.id === pid
            ? { ...p, tracks: rebalance([...p.tracks, { ...emptyTrack(), composers: lastComposer, publishers: lastPublisher, id: newId }]) }
            : p
        )
      );
      // eslint-disable-next-line no-await-in-loop
      await fillTrackFromFile(pid, newId, f);
    }
  }

  async function fillTrackFromFile(pid, tid, file) {
    updateTrack(pid, tid, { uploadStatus: 'reading' });
    const filenameGuess = file.name.replace(/\.[^/.]+$/, '');
    updateTrack(pid, tid, { track: filenameGuess });
    try {
      const buf = await file.arrayBuffer();
      const frames = readAudioTags(buf);
      const patch = {};
      if (frames.TIT2) patch.track = frames.TIT2;
      if (frames.TCOM) patch.composers = frames.TCOM;
      const { publisher, pro } = extractPublisherAndPro(frames);
      if (publisher) patch.publishers = publisher;
      if (pro) patch.pro = pro;
      patch.uploadStatus = '';
      updateTrack(pid, tid, patch);
    } catch (e) {
      updateTrack(pid, tid, { uploadStatus: '' });
    }
  }

  async function handleSave() {
    for (const p of projects) {
      if (!p.production.trim()) {
        alert('Each project needs a production title.');
        return;
      }
      for (const t of p.tracks) {
        if (!t.track.trim()) {
          alert('Each track needs a track name.');
          return;
        }
        if (t.pro === 'SESAC') {
          alert("One of these tracks is marked SESAC, which isn't cleared for use. Fix or remove that track before saving.");
          return;
        }
      }
    }

    setSaving(true);
    try {
      const rows = [];
      for (const p of projects) {
        for (const t of p.tracks) {
          rows.push({
            id: isEditing ? editingEntry.id : undefined,
            date: p.date || null,
            production: p.production.trim(),
            editor_email: p.editor,
            exhibition: p.exhibition.trim(),
            link: p.link.trim(),
            duration: p.duration.trim(),
            track: t.track.trim(),
            usage: t.usage,
            pro: t.pro,
            shares: t.shares.trim(),
            composers: t.composers.trim(),
            publishers: t.publishers.trim(),
            created_by: session.user.id,
          });
        }
      }

      const last = rows[rows.length - 1];
      if (last) {
        if (last.composers) setLastComposer(last.composers);
        if (last.publishers) setLastPublisher(last.publishers);
      }

      await onSaved(rows, isEditing);

      if (isEditing) {
        showToast('Changes saved ✓');
      } else {
        showToast(`Saved ${rows.length} track${rows.length === 1 ? '' : 's'} ✓`);
        setProjects([emptyProject(editorEmail, last?.composers || '', last?.publishers || '')]);
      }
    } catch (err) {
      showToast('Save failed: ' + (err?.message || 'unknown error') + ' — nothing was lost, your entries are still in the form.', true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 14 }}>{isEditing ? 'Edit track' : 'Log tracks'}</h2>

      {projects.map((p, pIdx) => (
        <div className="project-block" key={p.id}>
          <div className="project-block-header">
            <h3>Project</h3>
            {!isEditing && projects.length > 1 && (
              <button className="remove-project-btn" onClick={() => removeProject(p.id)}>Remove this project</button>
            )}
          </div>

          <div className="grid">
            <div className="field span3">
              <label>Production title / featured talent</label>
              <input
                type="text"
                placeholder="e.g. Taylor Hale - Why I'm Doing Playboy"
                value={p.production}
                onChange={(e) => updateProject(p.id, { production: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Date of production</label>
              <input type="date" value={p.date} onChange={(e) => updateProject(p.id, { date: e.target.value })} />
            </div>
            <div className="field">
              <label>Editor</label>
              <input type="text" value={p.editor} disabled title="Tied to your signed-in account" />
            </div>
            <div className="field">
              <label>Intended exhibition</label>
              {p.exhibitionEditing ? (
                <input
                  type="text"
                  value={p.exhibition}
                  onChange={(e) => updateProject(p.id, { exhibition: e.target.value })}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, padding: '8px 0 2px' }}>
                  <span>{p.exhibition}</span>
                  <button
                    type="button"
                    className="ghost"
                    style={{ padding: '2px 6px', fontSize: 12, textDecoration: 'underline' }}
                    onClick={() => updateProject(p.id, { exhibitionEditing: true })}
                  >
                    change
                  </button>
                </div>
              )}
            </div>
            <div className="field span2">
              <label>Content link</label>
              <input
                type="url"
                placeholder="https://instagram.com/p/…"
                value={p.link}
                onChange={(e) => updateProject(p.id, { link: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Content duration</label>
              <input type="text" placeholder="0:24" value={p.duration} onChange={(e) => updateProject(p.id, { duration: e.target.value })} />
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            {p.tracks.map((t) => (
              <div className="track-block" key={t.id}>
                <div className="track-block-header">
                  <span>Track</span>
                  {!isEditing && p.tracks.length > 1 && (
                    <button className="remove-track-btn" onClick={() => removeTrack(p.id, t.id)}>Remove this track</button>
                  )}
                </div>
                <div className="grid">
                  {!isEditing && (
                    <div className="field span3">
                      <label>Upload track file</label>
                      <input
                        type="file"
                        accept="audio/*"
                        multiple
                        onChange={(e) => handleFiles(p.id, t.id, e.target.files)}
                      />
                      {t.uploadStatus === 'reading' && (
                        <div className="upload-progress"><div className="upload-progress-fill" /></div>
                      )}
                    </div>
                  )}
                  <div className="field span3">
                    <label>Song / track name / number</label>
                    <input
                      type="text"
                      placeholder="e.g. XEL012_16_Slush Puppy"
                      value={t.track}
                      onChange={(e) => updateTrack(p.id, t.id, { track: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Usage</label>
                    <select value={t.usage} onChange={(e) => updateTrack(p.id, t.id, { usage: e.target.value })}>
                      <option value="Instrumental">Instrumental</option>
                      <option value="Vocal">Vocal</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>PRO affiliation</label>
                    <select value={t.pro} onChange={(e) => updateTrack(p.id, t.id, { pro: e.target.value })}>
                      <option value="">Select…</option>
                      <option>ASCAP</option>
                      <option>BMI</option>
                      <option>SESAC</option>
                      <option>GMR</option>
                      <option>SOCAN</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Shares %</label>
                    <input
                      type="text"
                      value={t.shares}
                      onChange={(e) => updateTrack(p.id, t.id, { shares: e.target.value, sharesTouched: true })}
                    />
                  </div>
                  <div className="field span2">
                    <label>Composer(s)</label>
                    <textarea
                      rows={2}
                      placeholder="Name / PRO - %, Name / PRO - %"
                      value={t.composers}
                      onChange={(e) => updateTrack(p.id, t.id, { composers: e.target.value })}
                    />
                  </div>
                  <div className="field span1">
                    <label>Publisher(s)</label>
                    <textarea
                      rows={2}
                      placeholder="Publisher name"
                      value={t.publishers}
                      onChange={(e) => updateTrack(p.id, t.id, { publishers: e.target.value })}
                    />
                  </div>
                  {t.pro === 'SESAC' && (
                    <div className="warning">
                      SESAC-affiliated tracks aren't cleared for use. Pick a different track's music bed before saving.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!isEditing && (
            <button type="button" className="ghost" style={{ margin: '2px 0 4px', textDecoration: 'underline', padding: '4px 0' }} onClick={() => addTrack(p.id)}>
              + Add another track
            </button>
          )}
        </div>
      ))}

      {!isEditing && (
        <button type="button" className="ghost" style={{ margin: '2px 0 16px', textDecoration: 'underline', padding: '4px 0' }} onClick={addProject}>
          + Add another project
        </button>
      )}

      <div className="panel-actions" style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
        {isEditing && <button onClick={onCancelEdit}>Cancel edit</button>}
        <button className="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Save track(s)'}
        </button>
      </div>
    </div>
  );
}
