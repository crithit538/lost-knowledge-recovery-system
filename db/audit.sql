-- Log when a user is marked departed
CREATE OR REPLACE FUNCTION trg_audit_departure() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'departed' AND OLD.status <> 'departed' THEN
    INSERT INTO audit_log (actor_id, action, target_table, target_id, details)
    VALUES (NULLIF(current_setting('app.user_id', true), '')::int,
            'USER_DEPARTED', 'app_user', NEW.user_id,
            NEW.full_name || ' marked as departed');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER audit_departure AFTER UPDATE ON app_user
FOR EACH ROW EXECUTE FUNCTION trg_audit_departure();

-- Log when an item is archived
CREATE OR REPLACE FUNCTION trg_audit_archive() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'archived' AND OLD.status <> 'archived' THEN
    INSERT INTO audit_log (actor_id, action, target_table, target_id, details)
    VALUES (NULLIF(current_setting('app.user_id', true), '')::int,
            'ITEM_ARCHIVED', 'knowledge_item', NEW.item_id,
            'Archived: ' || NEW.title);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER audit_archive AFTER UPDATE ON knowledge_item
FOR EACH ROW EXECUTE FUNCTION trg_audit_archive();