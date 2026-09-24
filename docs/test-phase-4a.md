# Phase 4A test guide: Experience Hub Dashboard

Open it with **Switch to Experience Hub Dashboard** at the bottom of the left menu.
Only super-admins see that link.

## Users

**Add a test user**
- [ ] Click **Add user**. Fill in a name, a made-up email (e.g. `admin-test@example.com`), a password of 8+ characters, role **Admin**, and tick **Mentor** only. Click **Create user**.
- [ ] The new user's panel opens, and they appear in the list as Admin with Mentor.
- [ ] Sign out, then sign in as that user. They can edit Mentor cases but not Quality Analyst or Curriculum. On Home, **Test my write access** confirms it. They have no "Switch to Experience Hub Dashboard" link.
- [ ] Sign back in as yourself.

**Edit, password, deactivate**
- [ ] Open the test user. Change the department, click **Save changes**, and the list updates.
- [ ] **Set a new password**: type a new one, click **Set password**, then check you can sign in with it.
- [ ] Set **Status** to **Deactivated**, write a note (e.g. "On leave"), and **Save changes**.
- [ ] In the list, hover over **Note** next to "Deactivated". The note appears.
- [ ] Try to sign in as that user. It's refused ("This account is not active…").

**Filters and export**
- [ ] Filters work: Section, Status, Role, search.
- [ ] **Export CSV** downloads the list as it's currently filtered. It opens in Excel.

**Delete**
- [ ] Open the test user, click **Delete user**, then **Yes, delete user**. The user disappears from the list.
- [ ] You can't delete your own account. It says to ask another super-admin.

## Activity Log
- [ ] The tabs **All / Quality Analyst / Curriculum / Mentor** filter the list.
- [ ] Filters work: User, Action (tick several), date range, search.
- [ ] The test user's creation, edits, password change, deactivation and deletion all appear, **under your name**.
- [ ] **Show details** lists each changed field, before and after.
- [ ] **Export CSV** works.

## Login History
- [ ] Your and the test user's sign-ins are listed, newest first.
- [ ] The User filter, date range and **Export CSV** work.

## Safety
- [ ] As the Viewer (`test@gmail.com`), going to `localhost:3000/admin` shows "Page not found".
