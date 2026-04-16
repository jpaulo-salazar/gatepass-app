-- Persist last issued sequence per year so "clear history" does not reset YYYYNNNN numbering.

CREATE TABLE IF NOT EXISTS document_series (
    kind VARCHAR(32) NOT NULL,
    year INT NOT NULL,
    last_seq INT NOT NULL DEFAULT 0,
    PRIMARY KEY (kind, year)
);

-- Backfill from existing document numbers (8-digit YYYYNNNN only).
INSERT INTO document_series (kind, year, last_seq)
SELECT 'gate_pass', y, m FROM (
    SELECT CAST(SUBSTRING(gp_number, 1, 4) AS UNSIGNED) AS y,
           MAX(CAST(SUBSTRING(gp_number, 5, 4) AS UNSIGNED)) AS m
    FROM gate_passes
    WHERE LENGTH(gp_number) = 8 AND gp_number REGEXP '^[0-9]{8}$'
    GROUP BY CAST(SUBSTRING(gp_number, 1, 4) AS UNSIGNED)
) AS src
ON DUPLICATE KEY UPDATE last_seq = GREATEST(document_series.last_seq, src.m);

INSERT INTO document_series (kind, year, last_seq)
SELECT 'transmittal', y, m FROM (
    SELECT CAST(SUBSTRING(transmittal_number, 1, 4) AS UNSIGNED) AS y,
           MAX(CAST(SUBSTRING(transmittal_number, 5, 4) AS UNSIGNED)) AS m
    FROM transmittals
    WHERE LENGTH(transmittal_number) = 8 AND transmittal_number REGEXP '^[0-9]{8}$'
    GROUP BY CAST(SUBSTRING(transmittal_number, 1, 4) AS UNSIGNED)
) AS src
ON DUPLICATE KEY UPDATE last_seq = GREATEST(document_series.last_seq, src.m);
