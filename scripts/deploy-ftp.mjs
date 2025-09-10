#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ftp from "basic-ftp";

async function main() {
  const host = process.env.FTP_HOST;
  const port = Number(process.env.FTP_PORT || 21);
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const remotePath = process.env.FTP_REMOTE_PATH || "/";
  const localDir = path.resolve("out");

  if (!host || !user || !password) {
    console.error("Missing FTP credentials. Set FTP_HOST, FTP_USER, FTP_PASS (and optional FTP_PORT, FTP_REMOTE_PATH).");
    process.exit(1);
  }
  if (!fs.existsSync(localDir)) {
    console.error(`Local directory not found: ${localDir}. Build first (next export).`);
    process.exit(1);
  }

  const client = new ftp.Client(30_000);
  client.ftp.verbose = true;
  try {
    console.log(`Connecting to ftp://${host}:${port} ...`);
    await client.access({ host, port, user, password, secure: false, secureOptions: undefined });
    console.log(`Ensuring remote path: ${remotePath}`);
    await client.ensureDir(remotePath);
    // Use passive mode; default is passive.
    await client.cd(remotePath);
    console.log(`Uploading directory: ${localDir} -> ${remotePath}`);
    // Upload and overwrite newer/changed files. Does not delete by default.
    await client.uploadFromDir(localDir);
    console.log("Deploy complete.");
  } catch (err) {
    console.error("FTP deploy failed:", err?.message || err);
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
