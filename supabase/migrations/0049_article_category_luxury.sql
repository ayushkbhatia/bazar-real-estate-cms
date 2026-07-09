-- Add the "Luxury" article category used by the client's Insights content.
-- ALTER TYPE ... ADD VALUE must run in its own migration: Postgres cannot add
-- an enum value and then reference it inside the same transaction, and the
-- 10-post seed in 0050 inserts a row with category = 'luxury'.
alter type article_category add value if not exists 'luxury';
