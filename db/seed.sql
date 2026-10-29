CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO department (name) VALUES ('Engineering'), ('Operations'), ('Finance');

-- Test password for every account: Password@123 (stored as a bcrypt hash)
INSERT INTO app_user (dept_id, full_name, email, password_hash, role, status, departed_on) VALUES
(1, 'Asha Rao',     'asha@example.com',    crypt('Password@123', gen_salt('bf')), 'admin',       'active',   NULL),
(1, 'Ravi Kumar',   'ravi@example.com',    crypt('Password@123', gen_salt('bf')), 'contributor', 'active',   NULL),
(2, 'Meena Iyer',   'meena@example.com',   crypt('Password@123', gen_salt('bf')), 'contributor', 'active',   NULL),
(1, 'Karthik S',    'karthik@example.com', crypt('Password@123', gen_salt('bf')), 'contributor', 'departed', '2026-09-30'),
(3, 'Divya Nair',   'divya@example.com',   crypt('Password@123', gen_salt('bf')), 'viewer',      'active',   NULL),
(3, 'Arjun Menon',  'arjun@example.com',   crypt('Password@123', gen_salt('bf')), 'contributor', 'active',   NULL);

INSERT INTO category (parent_id, name) VALUES
(NULL, 'Engineering'), (1, 'Deployment'), (1, 'Databases'),
(NULL, 'Operations'), (4, 'Incident Response'), (4, 'Vendor Management'),
(NULL, 'Finance'), (7, 'Month-End Close');

INSERT INTO knowledge_item (owner_id, category_id, title, body, criticality, status) VALUES
(4, 2, 'Deploying the billing service', 'Steps to build, tag and deploy the billing service to production, including the order of migrations.', 5, 'published'),
(4, 3, 'Restoring the nightly database backup', 'How to locate the latest backup, restore it to a staging server and verify row counts.', 5, 'published'),
(2, 2, 'Rolling back a failed release', 'Checklist for reverting a release and re-running health checks.', 4, 'published'),
(3, 5, 'Handling a payment gateway outage', 'Who to contact, how to switch to the backup gateway, and how to reconcile pending payments.', 5, 'published'),
(3, 6, 'Renewing the logistics vendor contract', 'Renewal timeline, required approvals and negotiation notes.', 3, 'published'),
(6, 8, 'Month-end reconciliation steps', 'Order of ledger checks, cut-off rules and sign-off process.', 4, 'published'),
(4, 3, 'Legacy report server quirks', 'Known issues and workarounds for the old reporting server.', 2, 'draft'),
(2, 3, 'Index tuning notes', 'Which indexes were added to the orders tables and why.', 3, 'published');

INSERT INTO tag (name) VALUES ('deployment'), ('backup'), ('incident'), ('vendor'), ('finance');

INSERT INTO item_tag (item_id, tag_id) VALUES
(1,1), (2,2), (3,1), (4,3), (5,4), (6,5), (7,2), (8,2);

INSERT INTO recovery_request (requester_id, item_id, assigned_to, topic, details, status, resolved_at) VALUES
(5, 1, 1,    'Need billing deploy steps', 'Owner has left, please confirm the steps are current.', 'assigned', NULL),
(2, NULL, NULL, 'Who knows the legacy report server?', 'Report server failed overnight.', 'open', NULL),
(5, 6, 1,    'Clarify month-end cut-off rules', 'Unsure about the cut-off date.', 'resolved', now());