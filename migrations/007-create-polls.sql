-- Create polls table
CREATE TABLE IF NOT EXISTS polls (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create poll_votes table to track votes by user
CREATE TABLE IF NOT EXISTS poll_votes (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add triggers for updated_at
CREATE TRIGGER update_polls_updated_at
    BEFORE UPDATE ON polls
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_poll_votes_updated_at
    BEFORE UPDATE ON poll_votes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
