import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const categories = sqliteTable("categories", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    icon: text("icon").notNull(),
    color: text("color").notNull(),
    type: text("type", { enum: ["income", "expense"] }).notNull(),
    createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
})

export const transactions = sqliteTable("transactions", {
    id: text("id").primaryKey(),
    amount: integer("amount").notNull(),
    type: text("type", { enum: ["income", "expense"] }).notNull(),
    categoryId: text("category_id").references(() => categories.id),
    savingsGoalId: text("savings_goal_id").references(() => savingsGoals.id),
    date: integer("date").notNull().$defaultFn(() => Date.now()),
    note: text("note"),
    createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
    updatedAt: integer("updated_at").notNull().$defaultFn(() => Date.now())
})

export const budgets = sqliteTable("budgets", {
    id: text("id").primaryKey(),
    period: text("period").notNull(),
    scope: text("scope", { enum: ["global", "category"] }).notNull(),
    categoryId: text("category_id").references(() => categories.id),
    amount: integer("amount").notNull(),
    createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
})

export const savingsGoals = sqliteTable("savings_goals", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    targetAmount: integer("target_amount"),
    icon: text("icon").notNull(),
    color: text("color").notNull(),
    createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
})

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;

export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type NewSavingsGoal = typeof savingsGoals.$inferInsert;