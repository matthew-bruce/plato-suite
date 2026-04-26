-- session_type column already exists on tessera_itinerary_sessions (added before this migration).
-- This migration is kept for audit trail; the ADD COLUMN IF NOT EXISTS is a safe no-op.
ALTER TABLE tessera_itinerary_sessions
  ADD COLUMN IF NOT EXISTS session_type TEXT;
