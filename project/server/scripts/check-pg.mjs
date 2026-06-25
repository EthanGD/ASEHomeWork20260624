import pg from "pg";

const ports = [5432, 5433];
const host = process.env.PGHOST ?? "127.0.0.1";
const user = process.env.PGUSER ?? "postgres";
const password = process.env.PGPASSWORD ?? "123qwe";
const database = process.env.PGDATABASE ?? "postgres";

const run = async () => {
  for (const port of ports) {
    const client = new pg.Client({ host, port, user, password, database });
    try {
      await client.connect();
      const result = await client.query("select version() as v");
      console.log(`OK port ${port}`);
      console.log(result.rows[0]?.v ?? "");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`FAIL port ${port}: ${message}`);
    } finally {
      try {
        await client.end();
      } catch {}
    }
  }
};

run();
