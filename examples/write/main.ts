import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { NewPackaging } from '@aasx/package3';

const require = createRequire(import.meta.url);
const aasCore31 = require('@aas-core-works/aas-core3.1-typescript') as typeof import('@aas-core-works/aas-core3.1-typescript');

function newExternalReference(value: string): InstanceType<typeof aasCore31.types.Reference> {
  return new aasCore31.types.Reference(aasCore31.types.ReferenceTypes.ExternalReference, [
    new aasCore31.types.Key(aasCore31.types.KeyTypes.GlobalReference, value)
  ]);
}

function createAASEnvironment(): InstanceType<typeof aasCore31.types.Environment> {
  const shellId = 'https://example.com/aas/example-aas';
  const submodelId = 'https://example.com/submodel/technical-data';

  const aas = new aasCore31.types.AssetAdministrationShell(
    shellId,
    new aasCore31.types.AssetInformation(aasCore31.types.AssetKind.Instance)
  );
  aas.idShort = 'ExampleAAS';
  aas.assetInformation.globalAssetId = 'https://example.com/asset/example-asset';
  aas.assetInformation.defaultThumbnail = new aasCore31.types.Resource('/thumbnail.png', 'image/png');

  const submodelRef = new aasCore31.types.Reference(aasCore31.types.ReferenceTypes.ModelReference, [
    new aasCore31.types.Key(aasCore31.types.KeyTypes.Submodel, submodelId)
  ]);
  aas.submodels = [submodelRef];

  const submodel = new aasCore31.types.Submodel(submodelId);
  submodel.idShort = 'TechnicalData';
  submodel.semanticId = newExternalReference('https://admin-shell.io/ZVEI/TechnicalData/Submodel/1/2');

  const manufacturerName = new aasCore31.types.Property(aasCore31.types.DataTypeDefXsd.String);
  manufacturerName.idShort = 'ManufacturerName';
  manufacturerName.value = 'Example Manufacturer';
  manufacturerName.semanticId = newExternalReference('0173-1#02-AAO677#002');

  const productName = new aasCore31.types.Property(aasCore31.types.DataTypeDefXsd.String);
  productName.idShort = 'ManufacturerProductDesignation';
  productName.value = 'Example Product';
  productName.semanticId = newExternalReference('0173-1#02-AAW338#001');

  const serialNumber = new aasCore31.types.Property(aasCore31.types.DataTypeDefXsd.String);
  serialNumber.idShort = 'SerialNumber';
  serialNumber.value = 'SN-12345-67890';
  serialNumber.semanticId = newExternalReference('0173-1#02-AAM556#002');

  const documentationFile = new aasCore31.types.File(undefined, undefined, 'TechnicalDocumentation');
  documentationFile.contentType = 'application/pdf';
  documentationFile.value = '/aasx-suppl/documentation.pdf';
  documentationFile.semanticId = newExternalReference('0173-1#02-AAV232#001');

  submodel.submodelElements = [manufacturerName, productName, serialNumber, documentationFile];

  const environment = new aasCore31.types.Environment();
  environment.assetAdministrationShells = [aas];
  environment.submodels = [submodel];

  return environment;
}

function serializeToJson(environment: InstanceType<typeof aasCore31.types.Environment>): Uint8Array {
  const jsonable = aasCore31.jsonization.toJsonable(environment);
  const jsonText = `${JSON.stringify(jsonable, null, 2)}\n`;
  return new TextEncoder().encode(jsonText);
}

async function run(): Promise<void> {
  console.log('Creating AASX package example...');

  const outputPath = process.argv[2] ?? 'example.aasx';
  console.log(`Output file: ${outputPath}\n`);

  const thisFile = fileURLToPath(import.meta.url);
  const thisDir = dirname(thisFile);

  console.log('Step 1: Creating AAS environment...');
  const environment = createAASEnvironment();
  const shell = environment.assetAdministrationShells?.[0];
  const submodel = environment.submodels?.[0];
  console.log(`  ✓ Created AAS with ID: ${shell?.idShort ?? shell?.id ?? '<missing>'}`);
  console.log(`  ✓ Created Submodel with ID: ${submodel?.idShort ?? submodel?.id ?? '<missing>'}`);

  console.log('\nStep 2: Serializing to JSON...');
  const jsonContent = serializeToJson(environment);
  console.log(`  ✓ Generated JSON (${jsonContent.length} bytes)`);

  console.log('\nStep 3: Loading supplementary files...');
  const thumbnailPath = join(thisDir, 'assets', 'thumbnail.png');
  const docPath = join(thisDir, 'assets', 'documentation.pdf');

  const thumbnailContent = new Uint8Array(await readFile(thumbnailPath));
  console.log(`  ✓ Loaded thumbnail (${thumbnailContent.length} bytes)`);

  const documentContent = new Uint8Array(await readFile(docPath));
  console.log(`  ✓ Loaded documentation PDF (${documentContent.length} bytes)`);

  console.log('\nStep 4: Creating AASX package...');
  const packaging = NewPackaging();
  const pkg = await packaging.Create(outputPath);

  console.log('\nStep 5: Adding AAS specification...');
  const spec = await pkg.PutPart(
    new URL('https://package.local/aasx/example-aas/aas.json'),
    'application/json',
    jsonContent
  );
  await pkg.MakeSpec(spec);
  console.log('  ✓ Added AAS spec at /aasx/example-aas/aas.json');

  console.log('\nStep 6: Adding thumbnail...');
  const thumbnail = await pkg.PutPart(
    new URL('https://package.local/thumbnail.png'),
    'image/png',
    thumbnailContent
  );
  await pkg.SetThumbnail(thumbnail);
  console.log('  ✓ Added thumbnail at /thumbnail.png');

  console.log('\nStep 7: Adding supplementary documentation...');
  const supplementary = await pkg.PutPart(
    new URL('https://package.local/aasx-suppl/documentation.pdf'),
    'application/pdf',
    documentContent
  );
  await pkg.RelateSupplementaryToSpec(supplementary, spec);
  console.log('  ✓ Added supplementary PDF at /aasx-suppl/documentation.pdf');

  console.log('\nStep 8: Saving package...');
  await pkg.Flush();
  console.log('  ✓ Package saved successfully!');

  await pkg.Close();

  console.log(`\n${'='.repeat(50)}`);
  console.log('AASX Package created successfully!');
  console.log(`${'='.repeat(50)}`);
  console.log(`\nOutput file: ${outputPath}`);
  console.log('\nPackage contents:');
  console.log('  - AAS JSON specification (application/json)');
  console.log('  - Thumbnail image (image/png)');
  console.log('  - Supplementary PDF document (application/pdf)');
  console.log('\nThis package can now be uploaded to BaSyx or other AAS servers.');
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
