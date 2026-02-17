# AASX Write Example

This example mirrors the Go write example and creates an AASX containing:

1. AAS JSON specification (`/aasx/example-aas/aas.json`)
2. Thumbnail (`/thumbnail.png`)
3. Supplementary document (`/aasx-suppl/documentation.pdf`)

It uses:

- `@aas-core-works/aas-core3.1-typescript`
- `aasx-package-ts` (this library)

The flow is the same as the Go example:

1. Create AAS environment model objects
2. Serialize the environment
3. Load supplementary assets
4. Create package and add parts

The only intentional difference is serialization: this example uses AAS JSONization instead of XMLization.

## Run

```bash
cd examples/write
npm install
npm run start
```

Optional custom output path:

```bash
npm run start:out
```
