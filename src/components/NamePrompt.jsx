import React, { useState } from 'react';

export default function NamePrompt({ onSave }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onSave(name.trim());
    } catch (err) {
      setError(err?.message || 'Something went wrong saving your name — try again.');
      setSaving(false);
    }
  }

  return (
    <div className="login-screen">
      <h1>One more thing</h1>
      <p>What's your name? This is what shows up on every track you log — one-time setup.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
        />
        <button className="primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </form>
      {error && <p style={{ color: '#8B2E2E', fontSize: 13, marginTop: 12 }}>{error}</p>}
    </div>
  );
}
