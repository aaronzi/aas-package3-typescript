# aas-package3-typescript

This project provides read/write support for AASX (AAS package) files in TypeScript.
It follows the same core approach and function naming as the Go implementation so users can move between both libraries with minimal friction.

## Features

- Open Packaging Convention (OPC) based AASX read/write
- Go-aligned entry points (`NewPackaging`, `Packaging`, `PackageRead`, `PackageReadWrite`, `Part`)
- Relationship support for specs, supplementary files, and thumbnails
- Node file-path APIs and browser-friendly byte/stream APIs
- Design-by-contract checks in debug mode (`Require`, `Ensure`)

## Installation

```bash
npm install @aasx/package3
```

## Quick Start

### Entry point

```ts
import { NewPackaging } from '@aasx/package3';

const packaging = NewPackaging();
```

### Create and write package

```ts
const pkg = await packaging.Create('example.aasx');
const spec = await pkg.PutPart(
    new URL('https://package.local/aasx/example-aas/aas.json'),
    'application/json',
    new TextEncoder().encode('{"assetAdministrationShells":[],"submodels":[]}')
);
await pkg.MakeSpec(spec);
await pkg.Flush();
await pkg.Close();
```

### Read package

```ts
const pkg = await packaging.OpenRead('example.aasx');
const specs = await pkg.Specs();
const thumbnail = await pkg.Thumbnail();
await pkg.Close();
```

## API Overview

Main classes and functions:

- `NewPackaging()`
- `Packaging`
- `PackageRead`
- `PackageReadWrite`
- `Part`
- `Require(condition, message)`
- `Ensure(condition, message)`

The library keeps behavior close to Go. One configured deviation is strict relationship cleanup on delete/overwrite to avoid dangling links.

## Runtime Support

- Node.js: use path-based APIs (`Create`, `OpenRead`, `OpenReadWrite`)
- Browser/in-memory: use stream/bytes APIs (`CreateInStream`, `OpenReadFromBytes`, `OpenReadWriteFromBytes`)

## Example

The write example is isolated in its own package at `examples/write` and uses `@aas-core-works/aas-core3.1-typescript` plus this library.

It includes the same two files as the Go example assets:

- `examples/write/assets/thumbnail.png`
- `examples/write/assets/documentation.pdf`

## Development

```bash
npm ci
npm run typecheck
npm run lint
npm run test:node
npm run test:browser
npm run build
```

## Documentation

- Main index: `doc/index.md`
- API: `doc/api/index.md`
- Getting started: `doc/getting-started/*`
- Contributing: `doc/contributing/*`

## CI and Dependency Updates

- Workflows: `.github/workflows`
- Dependabot: `.github/dependabot.yml`

## Contributing

See `CONTRIBUTING.md`.

## License

See `LICENSE`.

## Authors

See `AUTHORS`.
