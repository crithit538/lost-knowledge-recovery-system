-- Roles
CREATE ROLE kr_admin NOLOGIN;
CREATE ROLE kr_contributor NOLOGIN;
CREATE ROLE kr_viewer NOLOGIN;

-- Login role used by the API (change this password for your own use)
CREATE ROLE kr_app LOGIN NOINHERIT PASSWORD 'ChangeMe@123';
GRANT kr_admin, kr_contributor, kr_viewer TO kr_app;

GRANT USAGE ON SCHEMA public TO kr_app, kr_admin, kr_contributor, kr_viewer;

-- kr_app only needs to look users up at login (including the password hash)
GRANT SELECT ON app_user TO kr_app;

-- Admin: everything
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kr_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kr_admin;

-- Contributor
GRANT SELECT ON department, category, tag, item_tag, item_version, knowledge_item, recovery_request TO kr_contributor;
GRANT SELECT (user_id, dept_id, full_name, email, role, status, departed_on) ON app_user TO kr_contributor;
GRANT INSERT, UPDATE ON knowledge_item TO kr_contributor;
GRANT INSERT ON item_version, tag, item_tag, recovery_request TO kr_contributor;
GRANT DELETE ON item_tag TO kr_contributor;
GRANT UPDATE ON recovery_request TO kr_contributor;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kr_contributor;

-- Viewer: read only, plus raising recovery requests
GRANT SELECT ON department, category, tag, item_tag, knowledge_item, recovery_request TO kr_viewer;
GRANT SELECT (user_id, dept_id, full_name, email, role, status, departed_on) ON app_user TO kr_viewer;
GRANT INSERT ON recovery_request TO kr_viewer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kr_viewer;

-- Only admins can run the transfer procedure
REVOKE EXECUTE ON PROCEDURE transfer_knowledge(INT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON PROCEDURE transfer_knowledge(INT, INT, INT) TO kr_admin;

-- Row-level security on knowledge items
ALTER TABLE knowledge_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_all ON knowledge_item
  FOR ALL TO kr_admin USING (true) WITH CHECK (true);

CREATE POLICY viewer_read ON knowledge_item
  FOR SELECT TO kr_viewer USING (status = 'published');

CREATE POLICY contributor_read ON knowledge_item
  FOR SELECT TO kr_contributor
  USING (status = 'published'
         OR owner_id = NULLIF(current_setting('app.user_id', true), '')::int);

CREATE POLICY contributor_insert ON knowledge_item
  FOR INSERT TO kr_contributor
  WITH CHECK (owner_id = NULLIF(current_setting('app.user_id', true), '')::int);

CREATE POLICY contributor_update ON knowledge_item
  FOR UPDATE TO kr_contributor
  USING (owner_id = NULLIF(current_setting('app.user_id', true), '')::int)
  WITH CHECK (owner_id = NULLIF(current_setting('app.user_id', true), '')::int);