-- CreateTable
CREATE TABLE "audit_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_event_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "phase" TEXT NOT NULL DEFAULT 'REGISTRATION',
    "registration_closes_at" DATETIME NOT NULL,
    "event_starts_at" DATETIME NOT NULL,
    "location" TEXT NOT NULL,
    "matches_finalized_at" DATETIME,
    "data_purged_at" DATETIME,
    "lock_version" INTEGER NOT NULL DEFAULT 0,
    "session_epoch" INTEGER NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_event_settings" ("data_purged_at", "event_starts_at", "id", "location", "matches_finalized_at", "phase", "registration_closes_at", "updated_at") SELECT "data_purged_at", "event_starts_at", "id", "location", "matches_finalized_at", "phase", "registration_closes_at", "updated_at" FROM "event_settings";
DROP TABLE "event_settings";
ALTER TABLE "new_event_settings" RENAME TO "event_settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
