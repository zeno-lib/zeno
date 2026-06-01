// https://orm.drizzle.team/docs/seed-overview#complex-example
import "dotenv/config"
import { fileURLToPath } from "node:url"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { reset, seed } from "drizzle-seed"
import { getDrizzleSupabaseAdminClient } from "./clients.ts"
import {
  customers,
  details,
  employees,
  orders,
  products,
  suppliers,
} from "./schema.ts"

// Northwind subset — excludes the RLS `posts` table (which needs auth.users).
const schema = { customers, details, employees, orders, products, suppliers }

const titlesOfCourtesy = ["Ms.", "Mrs.", "Dr."]
const unitsOnOrders = [0, 10, 20, 30, 50, 60, 70, 80, 100]
const reorderLevels = [0, 5, 10, 15, 20, 25, 30]
const quantityPerUnit = [
  "100 - 100 g pieces",
  "100 - 250 g bags",
  "10 - 200 g glasses",
  "10 - 4 oz boxes",
  "10 - 500 g pkgs.",
]
const discounts = [0.05, 0.15, 0.2, 0.25]

// Counts are scaled down from the docs (10k+) to keep local seeding/tests fast.
export const SEED_COUNTS = {
  customers: 20,
  employees: 10,
  orders: 40,
  products: 30,
  suppliers: 15,
} as const

// Accepts any Drizzle client (e.g. the admin client); only the Northwind
// `schema` subset is reset/seeded, so the RLS `posts` table is left alone.
export async function seedDatabase<TSchema extends Record<string, unknown>>(
  db: PostgresJsDatabase<TSchema>
): Promise<void> {
  await reset(db, schema)
  await seed(db, schema).refine((funcs) => ({
    customers: {
      columns: {
        address: funcs.streetAddress(),
        city: funcs.city(),
        companyName: funcs.companyName(),
        contactName: funcs.fullName(),
        contactTitle: funcs.jobTitle(),
        country: funcs.country(),
        fax: funcs.phoneNumber({ template: "(###) ###-####" }),
        phone: funcs.phoneNumber({ template: "(###) ###-####" }),
        postalCode: funcs.postcode(),
        region: funcs.state(),
      },
      count: SEED_COUNTS.customers,
    },
    details: {
      columns: {
        discount: funcs.valuesFromArray({ values: discounts }),
        quantity: funcs.int({ maxValue: 130, minValue: 1 }),
        unitPrice: funcs.number({ maxValue: 130, minValue: 10 }),
      },
    },
    employees: {
      columns: {
        address: funcs.streetAddress(),
        birthDate: funcs.date({ maxDate: "2000-12-31", minDate: "1950-01-01" }),
        city: funcs.city(),
        country: funcs.country(),
        extension: funcs.int({ maxValue: 5467, minValue: 428 }),
        firstName: funcs.firstName(),
        hireDate: funcs.date({ maxDate: "2024-08-26", minDate: "2010-12-31" }),
        homePhone: funcs.phoneNumber({ template: "(###) ###-####" }),
        lastName: funcs.lastName(),
        notes: funcs.loremIpsum(),
        postalCode: funcs.postcode(),
        title: funcs.jobTitle(),
        titleOfCourtesy: funcs.valuesFromArray({ values: titlesOfCourtesy }),
      },
      count: SEED_COUNTS.employees,
    },
    orders: {
      columns: {
        freight: funcs.number({ maxValue: 1000, minValue: 0, precision: 100 }),
        shipCity: funcs.city(),
        shipCountry: funcs.country(),
        shipName: funcs.streetAddress(),
        shipPostalCode: funcs.postcode(),
        shipRegion: funcs.state(),
        shipVia: funcs.int({ maxValue: 3, minValue: 1 }),
      },
      count: SEED_COUNTS.orders,
      with: {
        details: [
          { count: [1, 2, 3, 4], weight: 0.6 },
          { count: [5, 6, 7, 8, 9, 10], weight: 0.2 },
          { count: [11, 12, 13, 14, 15, 16, 17], weight: 0.15 },
          { count: [18, 19, 20, 21, 22, 23, 24, 25], weight: 0.05 },
        ],
      },
    },
    products: {
      columns: {
        discontinued: funcs.int({ maxValue: 1, minValue: 0 }),
        name: funcs.companyName(),
        quantityPerUnit: funcs.valuesFromArray({ values: quantityPerUnit }),
        reorderLevel: funcs.valuesFromArray({ values: reorderLevels }),
        unitPrice: funcs.weightedRandom([
          { value: funcs.int({ maxValue: 300, minValue: 3 }), weight: 0.5 },
          {
            value: funcs.number({ maxValue: 300, minValue: 3, precision: 100 }),
            weight: 0.5,
          },
        ]),
        unitsInStock: funcs.int({ maxValue: 125, minValue: 0 }),
        unitsOnOrder: funcs.valuesFromArray({ values: unitsOnOrders }),
      },
      count: SEED_COUNTS.products,
    },
    suppliers: {
      columns: {
        address: funcs.streetAddress(),
        city: funcs.city(),
        companyName: funcs.companyName(),
        contactName: funcs.fullName(),
        contactTitle: funcs.jobTitle(),
        country: funcs.country(),
        phone: funcs.phoneNumber({ template: "(###) ###-####" }),
        region: funcs.state(),
      },
      count: SEED_COUNTS.suppliers,
    },
  }))
}

async function main(): Promise<void> {
  // Seeding bypasses RLS, so use the admin client.
  await seedDatabase(getDrizzleSupabaseAdminClient())
  console.log("Seeded Northwind dataset")
}

// Only run when invoked directly (`node src/seed.ts`), not when imported by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then(
    () => process.exit(0),
    (error) => {
      console.error(error)
      process.exit(1)
    }
  )
}
