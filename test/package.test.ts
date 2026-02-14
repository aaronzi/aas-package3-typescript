import { describe, expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { unzipSync, zipSync } from 'fflate';
import {
  ErrInvalidFormat,
  ErrNoOriginPart,
  NewPackaging,
  RelationTypeAasxSpec,
  RelationTypeAasxSupplementary,
  RelationTypeThumbnail,
  Require
} from '../src';

describe('Packaging', () => {
  test('creates empty package with origin and no specs', async () => {
    const packaging = NewPackaging();
    const pkg = await packaging.CreateInStream(memoryStream());

    const specs = await pkg.Specs();
    expect(specs).toHaveLength(0);

    const thumbnail = await pkg.Thumbnail();
    expect(thumbnail).toBeNull();
  });

  test('writes parts, relates spec and supplementary, round-trips bytes', async () => {
    const packaging = NewPackaging();
    const pkg = await packaging.CreateInStream(memoryStream());

    const specUri = new URL('https://package.local/aasx/spec.aas.xml');
    const supplUri = new URL('https://package.local/aasx/doc.pdf');
    const thumbUri = new URL('https://package.local/aasx/thumb.png');

    const spec = await pkg.PutPart(specUri, 'application/xml', new TextEncoder().encode('<aas/>'));
    const suppl = await pkg.PutPart(supplUri, 'application/pdf', new Uint8Array([1, 2, 3]));
    const thumb = await pkg.PutPart(thumbUri, 'image/png', new Uint8Array([9, 8, 7]));

    await pkg.MakeSpec(spec);
    await pkg.RelateSupplementaryToSpec(suppl, spec);
    await pkg.SetThumbnail(thumb);

    const bytes = await pkg.Flush();

    const reopened = await packaging.OpenReadFromBytes(bytes);
    const specs = await reopened.Specs();
    expect(specs).toHaveLength(1);
    expect(specs[0].URI.pathname).toBe('/aasx/spec.aas.xml');

    const rels = await reopened.SupplementaryRelationships();
    expect(rels).toHaveLength(1);
    expect(rels[0].Spec.URI.pathname).toBe('/aasx/spec.aas.xml');
    expect(rels[0].Supplementary.URI.pathname).toBe('/aasx/doc.pdf');

    const thumbnail = await reopened.Thumbnail();
    expect(thumbnail?.URI.pathname).toBe('/aasx/thumb.png');
  });

  test('deleting part removes dangling relationships in strict mode', async () => {
    const packaging = NewPackaging();
    const pkg = await packaging.CreateInStream(memoryStream());

    const spec = await pkg.PutPart(
      new URL('https://package.local/aasx/spec.aas.xml'),
      'application/xml',
      new TextEncoder().encode('<aas/>')
    );
    const supplementary = await pkg.PutPart(
      new URL('https://package.local/aasx/doc.pdf'),
      'application/pdf',
      new Uint8Array([1])
    );

    await pkg.MakeSpec(spec);
    await pkg.RelateSupplementaryToSpec(supplementary, spec);

    await pkg.DeletePart(spec);

    const bytes = await pkg.Flush();
    const reopened = await packaging.OpenReadFromBytes(bytes);

    const specs = await reopened.Specs();
    expect(specs).toHaveLength(0);

    const supplementaryRels = await reopened.SupplementaryRelationships();
    expect(supplementaryRels).toHaveLength(0);
  });

  test('relationship constants are preserved', () => {
    expect(RelationTypeAasxSpec).toContain('aas-spec');
    expect(RelationTypeAasxSupplementary).toContain('aas-suppl');
    expect(RelationTypeThumbnail).toContain('thumbnail');
  });

  test('Require throws in debug mode', () => {
    globalThis.__AASX_DEBUG_CONTRACTS__ = true;
    expect(() => Require(false, 'test')).toThrow('precondition violation');
    globalThis.__AASX_DEBUG_CONTRACTS__ = undefined;
  });

  test('returns invalid format error for malformed bytes', async () => {
    const packaging = NewPackaging();
    await expect(packaging.OpenReadFromBytes(new TextEncoder().encode('not a zip'))).rejects.toThrow(ErrInvalidFormat);
  });

  test('returns no origin error for empty OPC zip', async () => {
    const packaging = NewPackaging();
    await expect(packaging.OpenReadFromBytes(zipSync({}))).rejects.toThrow(ErrNoOriginPart);
  });

  test('groups specs by content type and sorts by URI path', async () => {
    const packaging = NewPackaging();
    const pkg = await packaging.CreateInStream(memoryStream());

    const a = await pkg.PutPart(new URL('https://package.local/aasx/some-company/data.json'), 'text/json', new TextEncoder().encode('{}'));
    const b = await pkg.PutPart(new URL('https://package.local/aasx/some-company/data1.json'), 'text/json', new TextEncoder().encode('{"x":1}'));
    const c = await pkg.PutPart(new URL('https://package.local/aasx/some-company/data.xml'), 'text/xml', new TextEncoder().encode('<a/>'));

    await pkg.MakeSpec(a);
    await pkg.MakeSpec(b);
    await pkg.MakeSpec(c);

    const grouped = await pkg.SpecsByContentType();
    expect(Object.keys(grouped).sort()).toEqual(['text/json', 'text/xml']);
    expect(grouped['text/json'].map((part) => part.URI.pathname)).toEqual([
      '/aasx/some-company/data.json',
      '/aasx/some-company/data1.json'
    ]);
    expect(grouped['text/xml'].map((part) => part.URI.pathname)).toEqual(['/aasx/some-company/data.xml']);
  });

  test('can include copied TestResources fixture files as parts', async () => {
    const packaging = NewPackaging();
    const pkg = await packaging.CreateInStream(memoryStream());

    const fixturePath = join(
      process.cwd(),
      'TestResources',
      'TestPackageRead',
      '01_Festo',
      'wwwcompanycomidsaas9350_1162_7091_7335.aas.xml'
    );
    const fixtureBytes = new Uint8Array(await readFile(fixturePath));

    const spec = await pkg.PutPart(
      new URL('https://package.local/aasx/fixture/01_Festo.aas.xml'),
      'application/xml',
      fixtureBytes
    );
    await pkg.MakeSpec(spec);

    const out = await pkg.Flush();
    const files = unzipSync(out);
    expect(files['aasx/fixture/01_Festo.aas.xml']).toBeTruthy();
  });
});

function memoryStream(): {
  readAll: () => Uint8Array;
  writeAll: (data: Uint8Array) => void;
} {
  let bytes = new Uint8Array();
  return {
    readAll: () => bytes,
    writeAll: (data: Uint8Array) => {
      bytes = data.slice();
    }
  };
}
