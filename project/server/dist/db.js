import { Pool } from "pg";
import { config } from "./config.js";
export const pool = new Pool(config.pg);
export const dbConnectionLabel = `${config.pg.user}@${config.pg.host}:${config.pg.port}/${config.pg.database}`;
export const query = async (text, params = []) => {
    return pool.query(text, params);
};
