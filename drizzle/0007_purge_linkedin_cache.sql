-- R-1: a single LinkedIn "Security Architecture…" sample poisoned the domain cache.
-- Deleting the row is required; write-path fixes do not expire an existing hit.
DELETE FROM "sender_category_cache"
WHERE "sender_domain" ILIKE '%linkedin%'
   OR "category" IN ('money', 'security');
