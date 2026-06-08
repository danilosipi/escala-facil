-- CreateTable
CREATE TABLE "StoreConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Minha Loja',
    "openTime" TEXT NOT NULL DEFAULT '07:00',
    "closeTime" TEXT NOT NULL DEFAULT '22:00',
    "operatingDays" TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
    "dailyWorkHours" INTEGER NOT NULL DEFAULT 8,
    "workDaysPerCycle" INTEGER NOT NULL DEFAULT 5,
    "offDaysPerCycle" INTEGER NOT NULL DEFAULT 2,
    "cycleLengthDays" INTEGER NOT NULL DEFAULT 7,
    "consecutiveOffDaysRequired" BOOLEAN NOT NULL DEFAULT false,
    "minEmployeesPerShift" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "preferredOffDays" TEXT NOT NULL DEFAULT '[]',
    "unavailableDates" TEXT NOT NULL DEFAULT '[]',
    "canWorkWeekend" BOOLEAN NOT NULL DEFAULT true,
    "cycleOffset" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conflicts" TEXT NOT NULL DEFAULT '[]'
);

-- CreateTable
CREATE TABLE "ScheduleAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "shiftId" TEXT,
    "date" TEXT NOT NULL,
    "isOff" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ScheduleAssignment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_month_year_key" ON "Schedule"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleAssignment_scheduleId_employeeId_date_key" ON "ScheduleAssignment"("scheduleId", "employeeId", "date");
