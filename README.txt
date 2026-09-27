STUDYVERSE 9 — PHASE 9 COMPLETE BUILD
========================================

This batch adds:
- Student dashboard
- Mathematics chapter browser
- Chapter resource viewer
- Admin dashboard
- Chapter CRUD/publish controls
- Resource CRUD/publish controls
- Announcement management
- Staff access page
- Explicit staff permission table
- Admin role/permission RPCs
- Admin activity audit table
- Existing Phase 8 chapter_progress/bookmarks/progress remain untouched
- Old Number Systems remains filtered from app UI

FILES
-----
index.html        Login/register
dashboard.html    Student dashboard
chapters.html     Mathematics chapter list
chapter.html      Chapter resources
admin.html        Admin control centre
staff.html        Staff permissions view
styles.css        Shared UI
config.js         Supabase URL + publishable key
app.js             Shared Supabase client/helpers
student.js        Student dashboard logic
admin.js          Admin logic
PHASE9_SETUP.sql  Database additions
README.txt        This guide

SETUP
-----
1. Run PHASE9_SETUP.sql in Supabase SQL Editor.
2. Replace/open your existing site's files with this Phase 9 package.
3. Keep the publishable key in config.js. NEVER put sb_secret_... or service_role in browser code.
4. Sign in as the existing Anurag Gupta admin.
5. Open admin.html and verify:
   - Total chapters = 8
   - Resources count
   - Users count
6. For staff:
   - Create/register the person's Auth account through your normal Supabase Auth flow.
   - Then use SQL/RPC admin_set_profile_role(user_id,'staff').
   - Use admin_set_staff_permissions(...) to grant permissions.
   - Staff cannot receive an admin secret key.

IMPORTANT
---------
The Phase 9 UI uses the existing resources table and dynamically recognises common resource column names. If your existing resources table has additional NOT NULL columns without defaults, resource creation may need one small schema-specific adjustment after the first attempted save.

The app intentionally keeps Part 2 as a locked UI section because no Part 2 chapters have been added yet.

Security note:
Supabase publishable keys are designed for browser clients when RLS and least-privilege policies are correctly configured. Secret/service-role keys must remain server-side.
