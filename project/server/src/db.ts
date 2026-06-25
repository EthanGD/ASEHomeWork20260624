import { Pool, QueryResult, QueryResultRow } from "pg";
import { config } from "./config.js";

export const pool = new Pool(config.pg);
export const dbConnectionLabel = `${config.pg.user}@${config.pg.host}:${config.pg.port}/${config.pg.database}`;

export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) => {
  return pool.query(text, params) as Promise<QueryResult<T>>;
};
