ALTER TABLE `transactions` ADD COLUMN `category` text DEFAULT 'general' NOT NULL;

UPDATE `transactions`
SET `category` = CASE
	WHEN LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%fuel%'
		OR LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%diesel%'
		OR LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%petrol%'
		OR LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%convoy%'
		THEN 'fuel'
	WHEN LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%truck%'
		OR LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%freight%'
		OR LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%logistic%'
		OR LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%transport%'
		THEN 'logistics'
	WHEN LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%grant%'
		OR LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%csr%'
		OR LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%fund%'
		THEN 'grant'
	WHEN LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%donation%'
		OR LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%donor%'
		OR LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%collection%'
		THEN 'donation'
	WHEN LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%medical%'
		OR LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%clinic%'
		OR LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%kit%'
		OR LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%oxygen%'
		THEN 'medical'
	WHEN LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%tarp%'
		OR LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%blanket%'
		OR LOWER(COALESCE(`reference`, '') || ' ' || COALESCE(`description`, '')) LIKE '%shelter%'
		THEN 'shelter'
	ELSE `category`
END
WHERE `category` = 'general';
