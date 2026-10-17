-- Auth credentials : unicité email case-insensitive + un jeton verify/reset par identifier.
-- Collisions lower(email) : garder Discord-linked (discordId / Account discord), sinon le plus ancien.
-- ATTENTION : soft-delete migration ≠ parcours softDeleteUserAccount (pas de revoke Discord/Stripe).
-- Preflight obligatoire avant prod :
--   SELECT lower(trim(email)), count(*) FROM "User" WHERE email IS NOT NULL AND "deletedAt" IS NULL
--   GROUP BY 1 HAVING count(*) > 1;
-- Backup DB requis (pas de DOWN). Index partiel lower(email) hors schema Prisma (volontaire).

WITH ranked AS (
  SELECT
    u.id,
    lower(trim(u.email)) AS email_lower,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(u.email))
      ORDER BY
        CASE
          WHEN u."discordId" IS NOT NULL THEN 0
          WHEN EXISTS (
            SELECT 1
            FROM "Account" a
            WHERE a."userId" = u.id
              AND a.provider = 'discord'
          ) THEN 0
          ELSE 1
        END,
        u."createdAt" ASC
    ) AS rn
  FROM "User" u
  WHERE u.email IS NOT NULL
    AND u."deletedAt" IS NULL
),
losers AS (
  SELECT id, email_lower FROM ranked WHERE rn > 1
),
del_tokens AS (
  DELETE FROM "VerificationToken" vt
  WHERE EXISTS (
    SELECT 1 FROM losers l
    WHERE vt.identifier IN (
      'email-verify:' || l.email_lower,
      'password-reset:' || l.email_lower
    )
  )
  RETURNING 1
),
upd AS (
  UPDATE "User" AS u
  SET
    "deletedAt" = NOW(),
    email = NULL,
    name = NULL,
    image = NULL,
    "discordId" = NULL,
    "emailVerified" = NULL,
    "passwordHash" = NULL,
    "totpEnabled" = false,
    "totpSecret" = NULL,
    "totpPendingSecret" = NULL,
    "totpRecoveryHashes" = NULL,
    "totpEnabledAt" = NULL
  FROM losers
  WHERE u.id = losers.id
  RETURNING u.id
),
del_sess AS (
  DELETE FROM "Session"
  WHERE "userId" IN (SELECT id FROM upd)
  RETURNING 1
)
DELETE FROM "Account"
WHERE "userId" IN (SELECT id FROM upd);

-- Normaliser les emails restants en lowercase.
UPDATE "User"
SET email = lower(trim(email))
WHERE email IS NOT NULL
  AND email IS DISTINCT FROM lower(trim(email));

-- Normaliser aussi les identifiers verify/reset historiques (casse).
UPDATE "VerificationToken"
SET identifier = 'email-verify:' || lower(substr(identifier, length('email-verify:') + 1))
WHERE identifier LIKE 'email-verify:%'
  AND identifier IS DISTINCT FROM ('email-verify:' || lower(substr(identifier, length('email-verify:') + 1)));

UPDATE "VerificationToken"
SET identifier = 'password-reset:' || lower(substr(identifier, length('password-reset:') + 1))
WHERE identifier LIKE 'password-reset:%'
  AND identifier IS DISTINCT FROM ('password-reset:' || lower(substr(identifier, length('password-reset:') + 1)));

-- Filet DB : unicité sur lower(email) pour les comptes actifs (hors schema Prisma).
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_lower_active_unique"
ON "User" (lower(email))
WHERE email IS NOT NULL AND "deletedAt" IS NULL;

-- Un seul VerificationToken par identifier (garder le plus récent).
-- Conserve l’index composite identifier_token (compat Auth.js).
DELETE FROM "VerificationToken" AS vt
WHERE vt.ctid NOT IN (
  SELECT DISTINCT ON (identifier) ctid
  FROM "VerificationToken"
  ORDER BY identifier, expires DESC
);

CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_key"
ON "VerificationToken" ("identifier");
