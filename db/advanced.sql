-- Trigger: save the old body as a new version whenever the body changes
CREATE OR REPLACE FUNCTION trg_version_item() RETURNS trigger AS $$
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body THEN
    INSERT INTO item_version (item_id, version_no, body)
    SELECT OLD.item_id, COALESCE(MAX(version_no), 0) + 1, OLD.body
    FROM item_version WHERE item_id = OLD.item_id;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER item_versioning
BEFORE UPDATE ON knowledge_item
FOR EACH ROW EXECUTE FUNCTION trg_version_item();

-- Function: how many critical items (criticality 4 or 5) a user owns
CREATE OR REPLACE FUNCTION fn_risk_score(p_user INT) RETURNS INT AS $$
  SELECT COUNT(*)::INT FROM knowledge_item
  WHERE owner_id = p_user AND criticality >= 4 AND status <> 'archived';
$$ LANGUAGE sql;

-- Procedure: move a departed user's items to another active user
CREATE OR REPLACE PROCEDURE transfer_knowledge(p_from INT, p_to INT, p_actor INT)
LANGUAGE plpgsql AS $$
DECLARE v_count INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_user WHERE user_id = p_from AND status = 'departed') THEN
    RAISE EXCEPTION 'Source user must be departed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app_user WHERE user_id = p_to AND status = 'active') THEN
    RAISE EXCEPTION 'Target user must be active';
  END IF;

  UPDATE knowledge_item SET owner_id = p_to
  WHERE owner_id = p_from AND status <> 'archived';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO audit_log (actor_id, action, target_table, target_id, details)
  VALUES (p_actor, 'TRANSFER_KNOWLEDGE', 'knowledge_item', p_from,
          v_count || ' items moved from user ' || p_from || ' to user ' || p_to);
END $$;