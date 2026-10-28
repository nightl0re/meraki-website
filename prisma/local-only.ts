// Refuses to continue when DATABASE_URL points at a database that isn't on
// this computer. The seed wipes every table and the tests write rows, so
// running them against the live (Vercel) database would destroy real data.
// To seed a remote demo database on purpose, set ALLOW_REMOTE_DB=1.
export function assertLocalDatabase(task: string) {
  const url = process.env.DATABASE_URL ?? "";
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    // Unparseable URL: let Prisma report the real problem.
    return;
  }
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
  if (!local && process.env.ALLOW_REMOTE_DB !== "1") {
    console.error(
      `\nStopped: ${task} would run against the database at "${host}", which is not on this computer.\n` +
        "Point DATABASE_URL at your local database (npx prisma dev) and try again.\n" +
        "If you really mean to use that database, run it with ALLOW_REMOTE_DB=1.\n",
    );
    process.exit(1);
  }
}
