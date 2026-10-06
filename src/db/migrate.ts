import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";

async function main() {
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("Migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
