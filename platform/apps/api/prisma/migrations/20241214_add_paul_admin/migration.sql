-- Add Paul as platform_admin
-- Temp password: CampAdmin2024! (he should change this on first login)

INSERT INTO "User" (
  id,
  email,
  "passwordHash",
  "firstName",
  "lastName",
  "platformRole",
  "platformActive",
  "mustChangePassword",
  "isActive",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'pomdal@gmail.com',
  '$2b$12$G.yqE/9HV/p7lykTXoowV.LqPUl/aAXGG1SDbgJVmZ4zvttC3y7a2',
  'Paul',
  'Admin',
  'platform_admin',
  true,
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  "platformRole" = 'platform_admin',
  "platformActive" = true,
  "isActive" = true,
  "updatedAt" = NOW();

-- Also grant platform_admin to all existing owners to fix permission issues
UPDATE "User" u
SET "platformRole" = 'platform_admin', "platformActive" = true
FROM "CampgroundMembership" m
WHERE m."userId" = u.id
  AND m.role = 'owner'
  AND u."platformRole" IS NULL;
