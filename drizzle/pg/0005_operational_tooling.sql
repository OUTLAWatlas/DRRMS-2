ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT 'general';

UPDATE "transactions"
SET "category" = CASE
    WHEN lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%fuel%'
        OR lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%diesel%'
        OR lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%petrol%'
        OR lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%convoy%'
        THEN 'fuel'
    WHEN lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%truck%'
        OR lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%freight%'
        OR lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%logistic%'
        OR lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%transport%'
        THEN 'logistics'
    WHEN lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%grant%'
        OR lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%csr%'
        OR lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%fund%'
        THEN 'grant'
    WHEN lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%donation%'
        OR lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%donor%'
        OR lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%collection%'
        THEN 'donation'
    WHEN lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%medical%'
        OR lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%clinic%'
        OR lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%kit%'
        OR lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%oxygen%'
        THEN 'medical'
    WHEN lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%tarp%'
        OR lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%blanket%'
        OR lower(coalesce("reference", '') || ' ' || coalesce("description", '')) LIKE '%shelter%'
        THEN 'shelter'
    ELSE "category"
END
WHERE "category" = 'general';
