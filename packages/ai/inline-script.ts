import { build } from "rolldown"

const QUERY = "?inline-script"
// What would end or reopen a `<script>` element early, or switch the HTML
// parser into its escaped script state.
const UNSAFE_IN_SCRIPT = /<\/script|<!--|<script/iu

/**
 * Loads `./file.ts?inline-script` as its browser bundle, minified, in a string:
 * the approval card inlines it, since the host's CSP allows no script origin.
 * Shared by tsdown and Vitest, which both run Rolldown plugins.
 */
export const inlineScript = () => ({
  async load(this: { addWatchFile?: (id: string) => void }, id: string) {
    if (!id.endsWith(QUERY)) {
      return null
    }
    const input = id.slice(0, -QUERY.length)
    const { output } = await build({
      input,
      logLevel: "warn",
      output: { format: "esm", minify: true },
      platform: "browser",
      write: false,
    })
    const [chunk] = output
    for (const module of chunk.moduleIds) {
      if (!(module.startsWith("\0") || module.includes("/node_modules/"))) {
        this.addWatchFile?.(module)
      }
    }
    if (UNSAFE_IN_SCRIPT.test(chunk.code)) {
      throw new Error(`${input} bundles a "</script", "<!--" or "<script"`)
    }
    return `export default ${JSON.stringify(chunk.code)}`
  },
  name: "zeno-inline-script",
})
