-- 0157 · A Fast Pre-Approval is `open` or `declined`; where an open one stands
-- is its stage (0158).
--
-- Its own file because Postgres can't use a new enum value in the transaction
-- that adds it, and 0158 does. Apply this one first, and commit it.

alter type public.mortgage_status add value if not exists 'open' before 'new';
