# Cue Sheet Tracker

A real, hosted version of the cue sheet tool — React + Vite frontend, Supabase for
the database and login, deployable to Render. Matches the stack your freelance CRM
already runs on.

## What this gets you that the Claude-artifact version didn't

- **Real accounts.** Editors sign in with their own email (magic link, no password).
  Every entry is tied to a verified identity — not a free-text name field anyone
  could type anything into.
- **Real permissions**, enforced by the database itself (Row Level Security), not
  just hidden in the UI: any signed-in editor can add tracks; editing or deleting a
  row is restricted to whoever created it, or an admin.
- **Live sync.** Everyone sees everyone else's entries the moment they're saved — no
  refresh, no merge logic, no risk of one person's stale tab overwriting another's work.
- **A URL you control**, not dependent on a Claude conversation staying published.

Everything else — multi-project/track batch logging, the ID3 metadata auto-fill
(tested against your real Extreme Music files), the automatic SESAC block, the
sortable/filterable tracker table, and the filtered CSV export — works the same as
the prototype.

---

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account/project.
2. Once it's created, open **SQL Editor** in the left sidebar → **New query**.
3. Paste in the entire contents of `supabase/schema.sql` (in this folder) and click **Run**.
   This creates the `cue_entries` table, a `profiles` table, and all the permission
   rules described above.
4. Go to **Project Settings → API**. You'll need two values from this page in a moment:
   the **Project URL** and the **anon public** key.

### Lock down who can sign up (important)

By default, Supabase lets *anyone* who enters an email address create an account.
For a tool like this, you almost certainly want to restrict that:

- Go to **Authentication → Sign In / Providers → Email**, and either:
  - Turn **off** "Allow new user signups," then manually invite each editor from
    **Authentication → Users → Invite user** (they'll get an email to set up access), **or**
  - Leave signups on, but note that this means anyone with a link to your app and
    a valid email can create an account — fine for a small trusted team, not for
    anything public-facing.

### Make yourself admin

After you sign in for the first time (step 4 below), come back to the **SQL Editor** and run:

```sql
update profiles set is_admin = true where email = 'you@yourcompany.com';
```

Admins can edit or delete *any* entry, not just their own. Repeat this for anyone
else who should have that ability.

---

## 2. Run it locally first (recommended before deploying)

You'll need [Node.js](https://nodejs.org) installed (v18 or newer).

```bash
cd cue-sheet-app
npm install
cp .env.example .env
```

Open `.env` and paste in your Supabase Project URL and anon key from step 1.

```bash
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`), sign in with your email,
and confirm everything works before deploying.

---

## 3. Deploy to Render

1. Push this folder to a GitHub repository (Render deploys from Git).
2. In Render, click **New → Static Site**, connect that repo.
3. Set:
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. Under **Environment**, add the same two variables from your `.env` file:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy. Render gives you a live URL (e.g. `cue-sheet-tracker.onrender.com`) —
   that's the link to send your editors.

Render's free tier spins down after 15 minutes idle and takes ~30–60 seconds to
wake back up on the next visit. Fine for a team tool used throughout the day;
upgrade to a paid instance later if that wait ever becomes annoying.

---

## 4. Brand assets (optional)

The fonts and Playboy logo from the prototype aren't included here — those are your
company's licensed assets, not something to check into a generic project. To add them:

1. Drop your font files into `src/assets/fonts/`.
2. Uncomment and fill in the `@font-face` block at the top of `src/styles.css`.
3. Drop your logo image into `src/assets/` and import it in `App.jsx`'s header
   (`<img src={logo} className="headbar-logo" />`).

Until you do, the app uses a clean black/white Inter-based look — fully usable,
just not fully branded.

---

## Project structure

```
cue-sheet-app/
├── supabase/schema.sql      ← run once in Supabase's SQL Editor
├── src/
│   ├── App.jsx               ← auth state, live data sync, tab routing
│   ├── supabaseClient.js
│   ├── lib/id3.js             ← the metadata parser, unchanged from the prototype
│   ├── components/
│   │   ├── Login.jsx
│   │   ├── LogTab.jsx          ← the logging form
│   │   ├── TrackerTab.jsx      ← the sortable table + filters
│   │   ├── ExportModal.jsx
│   │   └── Toast.jsx
│   └── styles.css
├── .env.example
└── package.json
```

## What's a genuine v1, not a polish pass

This is a working first build, not a battle-tested one. A few things worth knowing:

- No automated tests.
- No pagination — if the tracker grows into the thousands of rows, the table will
  need it eventually. Not a concern at department scale.
- Error messages from Supabase are shown close to raw in a couple of places; fine
  functionally, just not maximally polished copy.
- Realtime sync uses Supabase's default channel setup — solid for a team this size,
  not something stress-tested at high concurrency.
