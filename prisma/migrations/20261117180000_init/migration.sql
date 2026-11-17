-- CreateEnum
CREATE TYPE "BudgetTier" AS ENUM ('TIER_300_450', 'TIER_450_600');

-- CreateEnum
CREATE TYPE "EventPhase" AS ENUM ('REGISTRATION', 'MATCHED', 'EVENT_DAY', 'CLOSED');

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" TEXT NOT NULL,
    "email_hash" TEXT NOT NULL,
    "encrypted_email" TEXT NOT NULL,
    "otp_hash" TEXT,
    "otp_expires_at" TIMESTAMP(3),
    "otp_attempts" INTEGER NOT NULL DEFAULT 0,
    "otp_last_sent_at" TIMESTAMP(3),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "profile_token" TEXT NOT NULL,
    "kvkk_accepted_at" TIMESTAMP(3),
    "pledge_accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant_profiles" (
    "id" TEXT NOT NULL,
    "identity_ref" TEXT,
    "alias" TEXT NOT NULL,
    "alias_key" TEXT NOT NULL,
    "avatar_id" TEXT NOT NULL,
    "budget_tier" "BudgetTier" NOT NULL,
    "gift_hints" TEXT NOT NULL DEFAULT '',
    "gift_exclusions" TEXT NOT NULL DEFAULT '',
    "is_gift_ready" BOOLEAN NOT NULL DEFAULT false,
    "ticket_code" TEXT NOT NULL,
    "is_checked_in" BOOLEAN NOT NULL DEFAULT false,
    "checked_in_at" TIMESTAMP(3),
    "is_joker" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participant_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_interests" (
    "profile_id" TEXT NOT NULL,
    "interest_slug" TEXT NOT NULL,

    CONSTRAINT "profile_interests_pkey" PRIMARY KEY ("profile_id","interest_slug")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "giver_profile_id" TEXT NOT NULL,
    "receiver_profile_id" TEXT NOT NULL,
    "common_interests_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "phase" "EventPhase" NOT NULL DEFAULT 'REGISTRATION',
    "registration_closes_at" TIMESTAMP(3) NOT NULL,
    "event_starts_at" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "matches_finalized_at" TIMESTAMP(3),
    "data_purged_at" TIMESTAMP(3),
    "lock_version" INTEGER NOT NULL DEFAULT 0,
    "session_epoch" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "participant_profiles_alias_key_key" ON "participant_profiles"("alias_key");

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

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "profile_interests" ADD CONSTRAINT "profile_interests_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "participant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_giver_profile_id_fkey" FOREIGN KEY ("giver_profile_id") REFERENCES "participant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_receiver_profile_id_fkey" FOREIGN KEY ("receiver_profile_id") REFERENCES "participant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
