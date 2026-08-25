#!/usr/bin/env node
//
// Derive the stored form of the admin password.
//
//   node scripts/hash-password.mjs 'your password here'
//
// Put the output in .env.local as ADMIN_PASSWORD_HASH. The password itself is
// never stored, and never leaves this machine.
//
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const password = process.argv[2];

if (!password) {
    console.error("\n  usage: node scripts/hash-password.mjs 'your password'\n");
    process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const derived = await scryptAsync(password, salt, 64);

console.log(`\n  ADMIN_PASSWORD_HASH=${salt}:${derived.toString("hex")}`);
console.log(`  SESSION_SECRET=${randomBytes(32).toString("hex")}\n`);
