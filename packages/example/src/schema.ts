import {
  authenticatedOwnerInsertPolicy,
  authenticatedOwnerSelectPolicy,
  authUserId,
  primaryId,
  table,
  timestamps,
  unsecureTable,
} from "@zeno-lib/db/schema"
import type { AnyPgColumn } from "drizzle-orm/pg-core"
import { integer, numeric, text, timestamp, varchar } from "drizzle-orm/pg-core"

export const posts = table(
  "posts",
  {
    id: primaryId("uuid"),
    title: text("title").notNull(),
    userId: authUserId(),
    ...timestamps,
  },
  (t) => [
    authenticatedOwnerSelectPolicy("posts_owner_select", t.userId),
    authenticatedOwnerInsertPolicy("posts_owner_insert", t.userId),
  ]
)

export type InsertPost = typeof posts.$inferInsert
export type SelectPost = typeof posts.$inferSelect

// Northwind-style schema from the drizzle-seed complex example.
// https://orm.drizzle.team/docs/seed-overview#complex-example
export const customers = unsecureTable("customer", {
  address: text().notNull(),
  city: text().notNull(),
  companyName: text().notNull(),
  contactName: text().notNull(),
  contactTitle: text().notNull(),
  country: text().notNull(),
  fax: text(),
  id: varchar({ length: 256 }).primaryKey(),
  phone: text().notNull(),
  postalCode: text(),
  region: text(),
})

export const employees = unsecureTable("employee", {
  address: text().notNull(),
  birthDate: timestamp().notNull(),
  city: text().notNull(),
  country: text().notNull(),
  extension: integer().notNull(),
  firstName: text(),
  hireDate: timestamp().notNull(),
  homePhone: text().notNull(),
  id: integer().primaryKey(),
  lastName: text().notNull(),
  notes: text().notNull(),
  photoPath: text(),
  postalCode: text().notNull(),
  reportsTo: integer().references((): AnyPgColumn => employees.id),
  title: text().notNull(),
  titleOfCourtesy: text().notNull(),
})

export const suppliers = unsecureTable("supplier", {
  address: text().notNull(),
  city: text().notNull(),
  companyName: text().notNull(),
  contactName: text().notNull(),
  contactTitle: text().notNull(),
  country: text().notNull(),
  id: integer().primaryKey(),
  phone: text().notNull(),
  postalCode: text().notNull(),
  region: text(),
})

export const products = unsecureTable("product", {
  discontinued: integer().notNull(),
  id: integer().primaryKey(),
  name: text().notNull(),
  quantityPerUnit: text().notNull(),
  reorderLevel: integer().notNull(),
  supplierId: integer()
    .notNull()
    .references(() => suppliers.id, { onDelete: "cascade" }),
  unitPrice: numeric().notNull(),
  unitsInStock: integer().notNull(),
  unitsOnOrder: integer().notNull(),
})

export const orders = unsecureTable("order", {
  customerId: varchar({ length: 256 })
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  employeeId: integer()
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  freight: numeric().notNull(),
  id: integer().primaryKey(),
  orderDate: timestamp().notNull(),
  requiredDate: timestamp().notNull(),
  shipCity: text().notNull(),
  shipCountry: text().notNull(),
  shipName: text().notNull(),
  shipPostalCode: text(),
  shippedDate: timestamp(),
  shipRegion: text(),
  shipVia: integer().notNull(),
})

export const details = unsecureTable("order_detail", {
  discount: numeric().notNull(),
  orderId: integer()
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: integer()
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  quantity: integer().notNull(),
  unitPrice: numeric().notNull(),
})

export type InsertCustomer = typeof customers.$inferInsert
export type SelectCustomer = typeof customers.$inferSelect
export type InsertEmployee = typeof employees.$inferInsert
export type SelectEmployee = typeof employees.$inferSelect
export type InsertSupplier = typeof suppliers.$inferInsert
export type SelectSupplier = typeof suppliers.$inferSelect
export type InsertProduct = typeof products.$inferInsert
export type SelectProduct = typeof products.$inferSelect
export type InsertOrder = typeof orders.$inferInsert
export type SelectOrder = typeof orders.$inferSelect
export type InsertOrderDetail = typeof details.$inferInsert
export type SelectOrderDetail = typeof details.$inferSelect
