-- Add siteLocked to Reservation
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "siteLocked" BOOLEAN NOT NULL DEFAULT false;
