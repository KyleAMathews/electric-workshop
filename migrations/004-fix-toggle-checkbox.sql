-- Drop the old function
DROP FUNCTION IF EXISTS toggle_checkbox;

-- Create toggle function that atomically toggles the checkbox state
CREATE OR REPLACE FUNCTION toggle_checkbox(checkbox_id INTEGER, user_uuid UUID)
RETURNS TABLE (
  id INTEGER,
  checked BOOLEAN,
  user_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  txid BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH toggled AS (
    UPDATE checkboxes c
    SET checked = NOT c.checked,
        user_id = CASE 
          WHEN NOT c.checked THEN user_uuid  -- Only set user_id when checking
          ELSE NULL                        -- Clear user_id when unchecking
        END
    WHERE c.id = checkbox_id
    RETURNING 
      c.id,
      c.checked,
      c.user_id,
      c.created_at,
      c.updated_at
  )
  SELECT 
    t.id,
    t.checked,
    t.user_id,
    t.created_at,
    t.updated_at,
    txid_current() as txid
  FROM toggled t;
END;
$$ LANGUAGE plpgsql;
