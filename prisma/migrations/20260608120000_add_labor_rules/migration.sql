-- AlterTable
ALTER TABLE "Shift" ADD COLUMN "breakMinutes" INTEGER NOT NULL DEFAULT 60;

-- AlterTable
ALTER TABLE "StoreConfig" ADD COLUMN "holidayDates" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "StoreConfig" ADD COLUMN "laborRulesConfig" TEXT NOT NULL DEFAULT '{}';
