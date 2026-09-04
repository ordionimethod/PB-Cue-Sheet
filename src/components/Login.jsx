import React, { useState } from 'react';
import { supabase } from '../supabaseClient.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="login-screen">
      <h1>Cue Sheet Tracker</h1>
      {sent ? (
        <p>Check your email — we sent a sign-in link to <strong>{email}</strong>. Click it to open the tracker.</p>
      ) : (
        <>
          <p>Sign in with your work email. No password — we'll send you a one-click link.</p>
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="you@yourcompany.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="primary" type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>
          {error && <p style={{ color: '#8B2E2E', fontSize: 13, marginTop: 12 }}>{error}</p>}
        </>
      )}
    </div>
  );
}
