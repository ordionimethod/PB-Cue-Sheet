import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from './supabaseClient.js';
import Login from './components/Login.jsx';
import LogTab from './components/LogTab.jsx';
import TrackerTab from './components/TrackerTab.jsx';
import Toast from './components/Toast.jsx';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking, null = signed out
  const [entries, setEntries] = useState([]);
  const [tab, setTab] = useState('log');
  const [editingEntry, setEditingEntry] = useState(null);
  const [toast, setToast] = useState({ message: '', isError: false, visible: false });
  const toastTimer = useRef(null);

  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError, visible: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), isError ? 4500 : 2500);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => listener.subscription.unsubscribe();
  }, []);

  const fetchEntries = useCallback(async () => {
    const { data, error } = await supabase.from('cue_entries').select('*').order('date', { ascending: false });
    if (error) {
      showToast('Could not load entries: ' + error.message, true);
      return;
    }
    setEntries(data || []);
  }, [showToast]);

  useEffect(() => {
    if (!session) return;
    fetchEntries();

    // Live sync: any editor's add/edit/delete shows up for everyone immediately,
    // no manual refresh or merge logic needed — Postgres + RLS handles correctness.
    const channel = supabase
      .channel('cue_entries_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cue_entries' }, () => {
        fetchEntries();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [session, fetchEntries]);

  async function handleSaved(rows, isEditing) {
    if (isEditing) {
      const row = rows[0];
      const { id, ...fields } = row;
      const { error } = await supabase.from('cue_entries').update(fields).eq('id', id);
      if (error) throw new Error(error.message.includes('policy') ? "You can only edit your own entries (or ask an admin to)." : error.message);
      setEditingEntry(null);
      setTab('tracker');
    } else {
      const cleanRows = rows.map(({ id, ...rest }) => rest);
      const { error } = await supabase.from('cue_entries').insert(cleanRows);
      if (error) throw new Error(error.message);
    }
    fetchEntries();
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('cue_entries').delete().eq('id', id);
    if (error) {
      showToast(error.message.includes('policy') ? "You can only delete your own entries (or ask an admin to)." : error.message, true);
      return;
    }
    showToast('Entry deleted ✓');
    fetchEntries();
  }

  async function handleAddLink(id, link) {
    const { error } = await supabase.from('cue_entries').update({ link }).eq('id', id);
    if (error) {
      showToast(error.message.includes('policy') ? "You can only edit your own entries (or ask an admin to)." : error.message, true);
      return;
    }
    showToast('Link saved ✓');
    fetchEntries();
  }

  function startEdit(entry) {
    setEditingEntry(entry);
    setTab('log');
  }

  function cancelEdit() {
    setEditingEntry(null);
    setTab('tracker');
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (session === undefined) return null; // brief loading flash avoided
  if (!session) return <Login />;

  return (
    <div className="wrap">
      <div className="headbar">
        <div className="headbar-left">
          <div className="headbar-text"><h1>Cue Sheet Tracker</h1></div>
        </div>
        <div className="headbar-user">
          <span>{session.user.email}</span>
          <button onClick={handleSignOut}>Sign out</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'log' ? 'active' : ''}`} onClick={() => setTab('log')}>Log a track</button>
        <button className={`tab-btn ${tab === 'tracker' ? 'active' : ''}`} onClick={() => setTab('tracker')}>Full tracker</button>
      </div>

      {tab === 'log' ? (
        <LogTab
          key={editingEntry ? editingEntry.id : 'new'}
          session={session}
          editingEntry={editingEntry}
          onSaved={handleSaved}
          onCancelEdit={cancelEdit}
          showToast={showToast}
        />
      ) : (
        <TrackerTab entries={entries} onEdit={startEdit} onDelete={handleDelete} onAddLink={handleAddLink} />
      )}

      <Toast message={toast.message} isError={toast.isError} visible={toast.visible} />
    </div>
  );
}
