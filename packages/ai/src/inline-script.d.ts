// `inline-script.ts` turns this import into the file's browser bundle.
declare module "*?inline-script" {
  const code: string
  export default code
}
