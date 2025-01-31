-- Create checkboxes table
CREATE TABLE checkboxes (
  id SERIAL PRIMARY KEY,
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add trigger for updated_at
CREATE TRIGGER update_checkboxes_updated_at
    BEFORE UPDATE ON checkboxes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert 1000 unchecked boxes
INSERT INTO checkboxes (checked)
SELECT false
FROM generate_series(1, 1000);

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
    UPDATE checkboxes
    SET checked = NOT checked,
        user_id = CASE 
          WHEN NOT checked THEN user_uuid  -- Only set user_id when checking
          ELSE NULL                        -- Clear user_id when unchecking
        END
    WHERE id = checkbox_id
    RETURNING *
  )
  SELECT 
    toggled.id,
    toggled.checked,
    toggled.user_id,
    toggled.created_at,
    toggled.updated_at,
    txid_current() as txid
  FROM toggled;
END;
$$ LANGUAGE plpgsql;
