-- Rumuzlar için büyük/küçük harf duyarsız benzersizlik anahtarı.
-- Mevcut satırlar lower(trim(alias)) ile doldurulur. SQLite lower() yalnızca ASCII harfleri
-- küçültür; uygulama Türkçe kurallarla (tr-TR) küçültür. Bu migration yalnızca geliştirme
-- verisine (demo profiller) uygulanıyor, o veride ASCII dışı büyük harf yok.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_participant_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identity_ref" TEXT,
    "alias" TEXT NOT NULL,
    "alias_key" TEXT NOT NULL,
    "avatar_id" TEXT NOT NULL,
    "budget_tier" TEXT NOT NULL,
    "gift_hints" TEXT NOT NULL DEFAULT '',
    "gift_exclusions" TEXT NOT NULL DEFAULT '',
    "is_gift_ready" BOOLEAN NOT NULL DEFAULT false,
    "ticket_code" TEXT NOT NULL,
    "is_checked_in" BOOLEAN NOT NULL DEFAULT false,
    "checked_in_at" DATETIME,
    "is_joker" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_participant_profiles" ("alias", "alias_key", "avatar_id", "budget_tier", "checked_in_at", "created_at", "gift_exclusions", "gift_hints", "id", "identity_ref", "is_checked_in", "is_gift_ready", "is_joker", "ticket_code", "updated_at") SELECT "alias", lower(trim("alias")), "avatar_id", "budget_tier", "checked_in_at", "created_at", "gift_exclusions", "gift_hints", "id", "identity_ref", "is_checked_in", "is_gift_ready", "is_joker", "ticket_code", "updated_at" FROM "participant_profiles";
DROP TABLE "participant_profiles";
ALTER TABLE "new_participant_profiles" RENAME TO "participant_profiles";
CREATE UNIQUE INDEX "participant_profiles_identity_ref_key" ON "participant_profiles"("identity_ref");
CREATE UNIQUE INDEX "participant_profiles_alias_key" ON "participant_profiles"("alias");
CREATE UNIQUE INDEX "participant_profiles_alias_key_key" ON "participant_profiles"("alias_key");
CREATE UNIQUE INDEX "participant_profiles_ticket_code_key" ON "participant_profiles"("ticket_code");
CREATE INDEX "participant_profiles_budget_tier_idx" ON "participant_profiles"("budget_tier");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
