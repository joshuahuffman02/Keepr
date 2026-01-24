#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "platform", "apps", "api", "src");

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

const targetFiles = walk(root);

for (const filePath of targetFiles) {
  const content = fs.readFileSync(filePath, "utf8");
  if (!/\bRequest\b/.test(content)) continue;
  if (
    /from ["']express["']/.test(content) &&
    /Request\b/.test(content.match(/from ["']express["'][^\n]*\n?/g)?.join("") || "")
  ) {
    continue;
  }
  if (
    content.includes('import type { Request } from "express";') ||
    content.includes("import type { Request } from 'express';")
  ) {
    continue;
  }

  const lines = content.split("\n");
  let insertAt = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith("import ")) {
      insertAt = i + 1;
      continue;
    }
    if (lines[i].trim() === "") continue;
    break;
  }

  lines.splice(insertAt, 0, 'import type { Request } from "express";');
  fs.writeFileSync(filePath, lines.join("\n"));
}
