-- 036_resources_hidden_from_timeline.sql
--
-- Per-resource flag driving the Resource Timeline's "Presentation view" —
-- Matt curating which rows a screen-shared or exported view shows without
-- touching anyone's underlying allocation data.
--
-- Resource-level and NOT period-scoped: a person hidden from the timeline
-- stays hidden across every period the view spans (Q2 and Q3 alike), by
-- design — a deliberate product decision, not an oversight to revisit.
-- Purely a render-time filter: it feeds no cost calculation, no
-- deriveSegments/deriveGaps input, and Full view ignores it entirely, so
-- nothing about a hidden resource's own data is ever lost.
--
-- Defaults false so every existing and newly-created resource starts visible.

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS hidden_from_timeline BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.resources.hidden_from_timeline IS
  'Resource Timeline Presentation-view flag. Not period-scoped — hides this '
  'resource from every period the timeline spans. Full view ignores it. '
  'Purely a render-time filter: never an input to any cost calculation or '
  'to segment/gap derivation.';

-- RLS: inherits the existing resources_active_user_access ALL policy on the
-- parent table (single ALL policy for role authenticated). No new policy
-- required.
