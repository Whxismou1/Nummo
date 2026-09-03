import { db } from "@/db";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import migrations from "../drizzle/migrations";

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return <View>
      {error.message}
    </View>
  }

  if (!success) {
    return <View><ActivityIndicator /></View>
  }


  return <Stack />;
}
