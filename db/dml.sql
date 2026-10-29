-- INSERT
INSERT INTO app_user (dept_id, full_name, email, password_hash, role)
VALUES (2, 'Nisha Pai', 'nisha@example.com', crypt('Password@123', gen_salt('bf')), 'contributor');

INSERT INTO knowledge_item (owner_id, category_id, title, body, criticality, status)
VALUES (3, 6, 'Vendor onboarding checklist', 'Steps to onboard a new vendor and collect documents.', 3, 'draft');

INSERT INTO recovery_request (requester_id, topic, details)
VALUES (6, 'Who handles vendor audits?', 'Need the contact for the annual audit.');

-- UPDATE
UPDATE knowledge_item SET status = 'published' WHERE title = 'Vendor onboarding checklist';

UPDATE recovery_request SET status = 'assigned', assigned_to = 1
WHERE topic = 'Who knows the legacy report server?';

UPDATE app_user SET dept_id = 2 WHERE email = 'arjun@example.com';

-- DELETE
INSERT INTO tag (name) VALUES ('temp');
DELETE FROM tag WHERE name = 'temp';

DELETE FROM recovery_request WHERE status = 'resolved';