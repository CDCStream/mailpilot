-- B-2: purge any remaining LinkedIn / high-consequence cache rows.
DELETE FROM "sender_category_cache"
WHERE "sender_domain" ILIKE '%linkedin%'
   OR "sender_domain" ILIKE '%lnkd.in%'
   OR "category" IN ('money', 'security');

-- Immediate repair so ?category=security is not waiting on a re-triage worker.
UPDATE "messages"
SET "category" = 'notification'
WHERE "category" = 'security'
  AND (
    "from_address" ILIKE '%linkedin%'
    OR "from_address" ILIKE '%lnkd.in%'
  );
