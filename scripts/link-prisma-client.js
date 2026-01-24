#!/usr/bin/env node
/**
 * Link Prisma Client for pnpm Workspaces
 *
 * This script creates symlinks for the .prisma/client folder so TypeScript
 * can resolve the generated Prisma types in a pnpm monorepo setup.
 *
 * The issue: pnpm stores packages in a content-addressed store, and Prisma
 * generates its client inside the @prisma/client package folder. When TypeScript
 * follows the re-export from @prisma/client to .prisma/client, it can't find
 * the types because .prisma/client doesn't exist at the expected location.
 */

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const NODE_MODULES = path.join(ROOT_DIR, "node_modules");
const PNPM_STORE = path.join(NODE_MODULES, ".pnpm");

// Locations where we need .prisma symlinks
const SYMLINK_TARGETS = [
  path.join(NODE_MODULES, ".prisma"),
  path.join(ROOT_DIR, "platform", "apps", "api", "node_modules", ".prisma"),
];

function findPrismaClientFolder() {
  // Look for @prisma+client@* folders in .pnpm
  if (!fs.existsSync(PNPM_STORE)) {
    console.log("No .pnpm folder found, skipping Prisma client linking");
    return null;
  }

  const entries = fs.readdirSync(PNPM_STORE);
  const prismaClientFolder = entries.find(
    (entry) => entry.startsWith("@prisma+client@") && !entry.includes("runtime"),
  );

  if (!prismaClientFolder) {
    console.log("No @prisma/client package found in .pnpm, skipping");
    return null;
  }

  const prismaPath = path.join(PNPM_STORE, prismaClientFolder, "node_modules", ".prisma");

  if (!fs.existsSync(prismaPath)) {
    console.log("Prisma client not yet generated, run prisma generate first");
    return null;
  }

  return prismaPath;
}

function createSymlink(source, target) {
  // Remove existing symlink or directory (handle broken symlinks too)
  let stats;
  try {
    stats = fs.lstatSync(target);
  } catch (err) {
    if (err && err.code !== "ENOENT") {
      throw err;
    }
    stats = null;
  }

  if (stats) {
    if (stats.isSymbolicLink()) {
      fs.unlinkSync(target);
    } else if (stats.isDirectory()) {
      console.log(`  Skipping ${target} - is a real directory, not a symlink`);
      return false;
    }
  }

  // Ensure parent directory exists
  const parentDir = path.dirname(target);
  if (!fs.existsSync(parentDir)) {
    console.log(`  Parent directory doesn't exist: ${parentDir}`);
    return false;
  }

  try {
    fs.symlinkSync(source, target, "dir");
    console.log(`  Created: ${target}`);
    return true;
  } catch (err) {
    console.error(`  Failed to create symlink: ${err.message}`);
    return false;
  }
}

function main() {
  console.log("Linking Prisma client for TypeScript...");

  const prismaSource = findPrismaClientFolder();
  if (!prismaSource) {
    return;
  }

  console.log(`Found Prisma client at: ${prismaSource}`);

  let created = 0;
  for (const target of SYMLINK_TARGETS) {
    if (createSymlink(prismaSource, target)) {
      created++;
    }
  }

  console.log(`Done! Created ${created} symlink(s)`);
}

main();
