-- Create audit_log table for tracking privileged actions
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- e.g., "oauth_token_stored", "record_deleted", "oauth_disconnect"
  target_table TEXT, -- table affected (optional, for deletes/updates)
  target_id UUID, -- record ID affected (optional)
  details JSONB, -- additional context as JSON
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for querying audit logs by user and action
CREATE INDEX IF NOT EXISTS idx_audit_log_user_action ON audit_log(user_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target_table, target_id) WHERE target_table IS NOT NULL;

-- RLS: users can only see their own audit logs
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs"
  ON audit_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Only service role can insert audit logs"
  ON audit_log FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

-- Grant permissions
GRANT SELECT ON audit_log TO authenticated;
