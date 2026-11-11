import { defaultConfig, mergeConfig } from "@zeno-lib/test/configs"
import { inlineScript } from "./inline-script.ts"

export default mergeConfig(defaultConfig, { plugins: [inlineScript()] })
