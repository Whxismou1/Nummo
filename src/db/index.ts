import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

export const conn = openDatabaseSync("nummo.db");

export const db = drizzle(conn);
