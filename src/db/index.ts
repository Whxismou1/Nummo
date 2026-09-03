import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

const conn = openDatabaseSync("nummo.db")

export const db = drizzle(conn)
