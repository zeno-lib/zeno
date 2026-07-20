import "dotenv/config"
import { defineDrizzleConfig } from "@zeno-lib/db/config"

export default defineDrizzleConfig({ schema: "./src/db/schema.ts" })
