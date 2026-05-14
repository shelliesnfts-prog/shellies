-- Optimize raffle read APIs by doing aggregation in Postgres instead of
-- issuing one query per raffle from the Next.js API routes.

CREATE INDEX IF NOT EXISTS idx_shellies_entries_raffle_wallet_created
ON public.shellies_raffle_entries (raffle_id, wallet_address, created_at);

CREATE INDEX IF NOT EXISTS idx_shellies_entries_wallet_raffle_created
ON public.shellies_raffle_entries (wallet_address, raffle_id, created_at);

CREATE INDEX IF NOT EXISTS idx_shellies_raffles_status_created
ON public.shellies_raffle_raffles (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_raffle_entry_summaries(
  p_raffle_ids integer[],
  p_wallet_address text DEFAULT NULL
)
RETURNS TABLE (
  raffle_id integer,
  participant_count integer,
  total_tickets integer,
  user_ticket_count integer
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    e.raffle_id,
    COUNT(DISTINCT e.wallet_address)::integer AS participant_count,
    COALESCE(SUM(e.ticket_count), 0)::integer AS total_tickets,
    COALESCE(
      SUM(e.ticket_count) FILTER (
        WHERE p_wallet_address IS NOT NULL
          AND e.wallet_address = LOWER(p_wallet_address)
      ),
      0
    )::integer AS user_ticket_count
  FROM public.shellies_raffle_entries e
  WHERE e.raffle_id = ANY(p_raffle_ids)
  GROUP BY e.raffle_id;
$$;

CREATE OR REPLACE FUNCTION public.get_raffle_participants_summary(
  p_raffle_id integer
)
RETURNS TABLE (
  wallet_address text,
  ticket_count integer,
  points_spent numeric,
  created_at timestamptz,
  join_tx_hash text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    e.wallet_address,
    COALESCE(SUM(e.ticket_count), 0)::integer AS ticket_count,
    COALESCE(SUM(e.points_spent), 0)::numeric AS points_spent,
    MIN(e.created_at) AS created_at,
    (ARRAY_AGG(e.join_tx_hash ORDER BY e.created_at ASC))[1] AS join_tx_hash
  FROM public.shellies_raffle_entries e
  WHERE e.raffle_id = p_raffle_id
  GROUP BY e.wallet_address
  ORDER BY MIN(e.created_at) ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_raffle_entry_summaries(integer[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_raffle_participants_summary(integer) TO authenticated;

COMMENT ON FUNCTION public.get_raffle_entry_summaries(integer[], text)
IS 'Aggregates participant counts, total tickets, and optional user ticket counts for a page of raffles.';

COMMENT ON FUNCTION public.get_raffle_participants_summary(integer)
IS 'Aggregates raffle participant rows by wallet for modal display.';
