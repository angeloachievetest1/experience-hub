# Phase 1 setup and test guide

Plain steps for the project owner. Do them in order.

---

## 1. Install the two tools the project needs (one time)

1. **Node.js**: go to <https://nodejs.org>, download the **LTS** version for Windows, run the installer, and accept the defaults.
2. **Git**: go to <https://git-scm.com/download/win>, download "Git for Windows", run the installer, and accept the defaults.
3. Close and reopen the Claude app (or your terminal) so it can find the new tools.

## 2. Turn off public sign-ups in Supabase (one time, important)

Only super-admins should create accounts.

1. Open your project at <https://supabase.com/dashboard>.
2. Left menu: **Authentication** → **Sign In / Providers** (on some versions: **Settings**).
3. Switch **Allow new users to sign up** to **off**, then **Save**.

(Even if this is left on, new accounts start deactivated and can't see anything, but switching it off is cleaner.)

## 3. Put your Supabase keys in `.env.local`

`.env.local` is a private settings file in the project folder. It is never uploaded to GitHub.

1. In Supabase, click **Connect** (top of the project page), or go to **Project Settings** → **API Keys**.
2. Open `.env.local` in the project folder with Notepad and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`: the **Project URL** (looks like `https://abcd1234.supabase.co`).
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the **Publishable key** (starts `sb_publishable_`) or the legacy **anon public** key.
   - `SUPABASE_SERVICE_ROLE_KEY`: the **Secret key** (starts `sb_secret_`) or the legacy **service_role** key. This is not used until Phase 4. Keep it secret.
3. For the database connection: click **Connect** → **Connection String** tab → choose **Session pooler**. Copy the string exactly as shown (it contains `[YOUR-PASSWORD]`) and paste it after `DATABASE_URL=`.
4. Put your **database password** after `SUPABASE_DB_PASSWORD=`. This is the password you chose when you created the Supabase project. If you've forgotten it: **Project Settings** → **Database** → **Reset database password**.
5. Save the file.

Never paste these keys into a chat, an email or GitHub.

## 4. Create the database tables

Claude runs these commands for you. For reference:

```bash
npm install
```

```bash
npm run db:migrate
```

```bash
npm run db:test
```

`db:test` creates temporary test users, checks every security rule, and then undoes everything.

## 5. Create your own super-admin account

1. Supabase → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter your email and a strong password. Tick **Auto Confirm User**. Click **Create user**.
3. Supabase → **SQL Editor** → **New query**. Paste this one line, **change the name and email to yours**, then click **Run**:

```sql
update public.profiles set full_name = 'Your Name', role = 'admin', sections = '{quality_analyst,curriculum,mentor}', is_super_admin = true, status = 'active', deactivation_note = null where email = 'you@example.com';
```

It should say **Success. 1 row affected**. If it says 0 rows, the email doesn't match exactly.

## 6. Create a Viewer test account

1. Same as step 5.1–5.2, with a second email you control. It can be made up, for example `viewer-test@yourdomain.com`, because no email is ever sent.
2. In the SQL Editor, run this line with that email:

```sql
update public.profiles set full_name = 'Test Viewer', role = 'viewer', sections = '{}', status = 'active', deactivation_note = null where email = 'viewer-test@yourdomain.com';
```

## 7. Start the app on your computer

```bash
npm run dev
```

Open <http://localhost:3000> in your browser. Leave the terminal window open while you test. Press `Ctrl + C` in it to stop the app.

---

## Test checklist

**As yourself (super-admin):**

- [ ] Going to <http://localhost:3000> sends you to the **Sign in** page.
- [ ] A wrong password shows "That email and password don't match".
- [ ] Your real password takes you to **Home** ("Welcome, …").
- [ ] The left menu shows **Quality Analyst** (6 pages), **Curriculum** (3), **Mentor** (2). Each opens a placeholder page.
- [ ] At the bottom of the menu you see **Switch to Experience Hub Dashboard**. It opens Users / Activity Log / Login History placeholders. **Back to Experience Hub** returns.
- [ ] On Home, **Your access** says Admin, can edit all three sections, super-admin Yes.
- [ ] **Test my write access** shows all three sections allowed, each marked "Matches your profile".
- [ ] **Sign out** returns you to the Sign in page.

**As the Viewer test account:**

- [ ] Sign in. The menu shows the three sections but **no** "Switch to Experience Hub Dashboard" link.
- [ ] Type <http://localhost:3000/admin> into the address bar. You get "Page not found".
- [ ] On Home, **Test my write access** shows all three sections as **"Database blocks changes (read only)"**, each marked "Matches your profile". The database refused the write, not just the screen.

**Deactivation:**

- [ ] While signed in as the Viewer in the browser, run this in the Supabase SQL Editor:
  ```sql
  update public.profiles set status = 'deactivated', deactivation_note = 'Testing' where email = 'viewer-test@yourdomain.com';
  ```
- [ ] Click any page in the app. You are sent back to the Sign in page.
- [ ] Trying to sign in again as the Viewer shows the same message.
- [ ] Reactivate it for later phases:
  ```sql
  update public.profiles set status = 'active', deactivation_note = null where email = 'viewer-test@yourdomain.com';
  ```

**Audit trail** (optional, in the Supabase SQL Editor):

```sql
select occurred_at, actor_name, action, summary from public.activity_log order by occurred_at desc limit 20;
```

```sql
select signed_in_at, user_email from public.login_history order by signed_in_at desc limit 20;
```

You should see your role changes and the Viewer deactivation in the first query, and one row per sign-in in the second.
