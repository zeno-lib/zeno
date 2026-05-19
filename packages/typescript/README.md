# TypeScript Configuration

This package provides shared TypeScript configurations for the monorepo, with progressive levels of strictness and framework-specific settings.

## Configurations

### `base.json`

The foundation configuration with modern ESM features and sensible defaults.

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    // Enable top-level await, and other modern ESM features.
    "target": "ES6",
    "module": "ESNext",    
    // Enable module resolution without file extensions on relative paths, for things like npm package imports.
    "moduleResolution": "Bundler",    
    // Allow importing TypeScript files using their native extension (.ts(x)).
    "allowImportingTsExtensions": true,    
    // Enable JSON imports.
    "resolveJsonModule": true,    
    // Enforce the usage of type-only imports when needed, which helps avoiding bundling issues.
    "verbatimModuleSyntax": true,    
    // Speed up compilation by saving information about the project graph from the last compilation
    "incremental": true,    
    // Ensure that each file can be transpiled without relying on other imports.
    // This is redundant with the previous option, however it ensures that it's on even if someone disable `verbatimModuleSyntax`
    "isolatedModules": true,    
    // Astro directly run TypeScript code, no transpilation needed.
    "noEmit": true,    
    // Report an error when importing a file using a casing different from another import of the same file.
    "forceConsistentCasingInFileNames": true,    
    // Properly support importing CJS modules in ESM
    "esModuleInterop": true,    
    // Skip typechecking libraries and .d.ts files
    "skipLibCheck": true,    
    // Allow JavaScript files to be imported
    "allowJs": true
  }
}
```

### `strict.json`

Extends `base.json` with strict type checking enabled.

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    // Enable strict mode. This enables a few options at a time, see https://www.typescriptlang.org/tsconfig#strict for a list.
    "strict": true
  }
}
```

### `strictest.json`

Extends `strict.json` with the most stringent rules for maximum type safety.

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./strict.json",
  "compilerOptions": {
    // Report errors for fallthrough cases in switch statements
    "noFallthroughCasesInSwitch": true,    
    // Force functions designed to override their parent class to be specified as `override`.
    "noImplicitOverride": true,    
    // Force functions to specify that they can return `undefined` if a possible code path does not return a value.
    "noImplicitReturns": true,    
    // Report an error when a variable is declared but never used.
    "noUnusedLocals": true,    
    // Report an error when a parameter is declared but never used.
    "noUnusedParameters": true,    
    // Force the usage of the indexed syntax to access fields declared using an index signature.
    "noUncheckedIndexedAccess": true,    
    // Report an error when the value `undefined` is given to an optional property that doesn't specify `undefined` as a valid value.
    // "exactOptionalPropertyTypes": true,    
    // Report an error for unreachable code instead of just a warning.
    "allowUnreachableCode": false,    
    // Report an error for unused labels instead of just a warning.
    "allowUnusedLabels": false
  }
}
```

### `react.json`

Extends `strictest.json` with React-specific configurations.

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./strictest.json",
  "compilerOptions": {
    // Allow JSX files (or files that are internally considered JSX, like Astro files) to be imported inside `.js` and `.ts` files.
    "jsx": "preserve",    
    // React needed libs
    "lib": ["dom", "dom.iterable", "esnext"]
  }
}
```

### `nextjs.json`

Extends `react.json` with Next.js-specific configurations.

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./react.json",
  "compilerOptions": {
    // Uncomment and configure these if you need custom path mapping:
    // "baseUrl": "${configDir}",
    // "paths": {
    //   "@/*": ["${configDir}/*"]
    // },
    "plugins": [{ "name": "next" }]
  },
  "include": [
    "${configDir}/next-env.d.ts",
    "${configDir}/.next/types/**/*.ts",
    "${configDir}/**/*.ts",
    "${configDir}/**/*.tsx"
  ]
}
```

## Usage

Choose the appropriate configuration based on your needs:

- **`base.json`**: For basic TypeScript projects with modern ESM support
- **`strict.json`**: For projects that want strict type checking
- **`strictest.json`**: For projects that want maximum type safety (recommended)
- **`react.json`**: For React applications
- **`nextjs.json`**: For Next.js applications

### Example

In your project's `tsconfig.json`:

```json
{
  "extends": "@zeno-lib/typescript/nextjs.json",
  "compilerOptions": {
    // Your project-specific overrides
  },
  "include": [
    // Your project-specific includes
  ]
}
```

## Configuration Hierarchy

```
base.json
└── strict.json
    └── strictest.json
        └── react.json
            └── nextjs.json
```
