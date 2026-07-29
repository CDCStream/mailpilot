// Pushes RESEND_API_KEY from .env.local to Vercel production (value never printed).
import { readFileSync } from "fs";
import { spawnSync } from "child_process";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

for (const key of ["RESEND_API_KEY", "BRIEF_FROM_EMAIL"]) {
  const value = env[key];
  if (!value) {
    console.error(`${key} not found in .env.local`);
    process.exit(1);
  }
  // Remove first in case it exists, then add.
  spawnSync("npx", ["vercel", "env", "rm", key, "production", "--yes"], {
    shell: true,
    stdio: "ignore",
  });
  const res = spawnSync("npx", ["vercel", "env", "add", key, "production"], {
    shell: true,
    input: value,
    encoding: "utf8",
  });
  console.log(res.status === 0 ? `${key} -> production OK` : `${key} FAILED\n${res.stderr}`);
}
