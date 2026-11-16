-- CreateTable
CREATE TABLE "auth_identities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email_hash" TEXT NOT NULL,
    "encrypted_email" TEXT NOT NULL,
    "otp_hash" TEXT,
    "otp_expires_at" DATETIME,
    "otp_attempts" INTEGER NOT NULL DEFAULT 0,
    "otp_last_sent_at" DATETIME,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "profile_token" TEXT NOT NULL,
    "kvkk_accepted_at" DATETIME,
    "pledge_accepted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "participant_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identity_ref" TEXT,
    "alias" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "profile_interests" (
    "profile_id" TEXT NOT NULL,
    "interest_slug" TEXT NOT NULL,

    PRIMARY KEY ("profile_id", "interest_slug"),
    CONSTRAINT "profile_interests_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "participant_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "giver_profile_id" TEXT NOT NULL,
    "receiver_profile_id" TEXT NOT NULL,
    "common_interests_count" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "matches_giver_profile_id_fkey" FOREIGN KEY ("giver_profile_id") REFERENCES "participant_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "matches_receiver_profile_id_fkey" FOREIGN KEY ("receiver_profile_id") REFERENCES "participant_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "event_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "phase" TEXT NOT NULL DEFAULT 'REGISTRATION',
    "registration_closes_at" DATETIME NOT NULL,
    "event_starts_at" DATETIME NOT NULL,
    "location" TEXT NOT NULL,
    "matches_finalized_at" DATETIME,
    "data_purged_at" DATETIME,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_email_hash_key" ON "auth_identities"("email_hash");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_profile_token_key" ON "auth_identities"("profile_token");

-- CreateIndex
CREATE UNIQUE INDEX "participant_profiles_identity_ref_key" ON "participant_profiles"("identity_ref");

-- CreateIndex
CREATE UNIQUE INDEX "participant_profiles_alias_key" ON "participant_profiles"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "participant_profiles_ticket_code_key" ON "participant_profiles"("ticket_code");

-- CreateIndex
CREATE INDEX "participant_profiles_budget_tier_idx" ON "participant_profiles"("budget_tier");

-- CreateIndex
CREATE INDEX "profile_interests_interest_slug_idx" ON "profile_interests"("interest_slug");

-- CreateIndex
CREATE UNIQUE INDEX "matches_giver_profile_id_key" ON "matches"("giver_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "matches_receiver_profile_id_key" ON "matches"("receiver_profile_id");
