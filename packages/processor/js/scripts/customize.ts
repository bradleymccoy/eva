import path from 'path';
import Ajv from 'ajv';
import merge from 'lodash.merge';
import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'fs';
import rimraf from 'rimraf';
import { generateMappingPackage } from './generate';
import {
  SchemaType,
  CustomSchemaType,
} from '@eva-design/dss';

const packages: string[] = process.argv.splice(2);

if (packages.length !== 2) {
  console.error(`
    Invalid arguments.
    Please specify source mapping name and customization mapping path.
  `);
  process.exit(1);
}

const currentDir: string = process.cwd();
const packagesDir: string = path.resolve(currentDir, 'packages');
const dssDir: string = path.resolve(currentDir, 'packages/dss');

export function customize(source: SchemaType, destination: CustomSchemaType): SchemaType {
  return merge(source, destination);
}

const json = (input: any): string => JSON.stringify(input, null, 2);

const {
  [0]: sourcePackageName,
  [1]: customMappingDerivedPath,
} = packages;

const sourcePackagePath: string = path.resolve(packagesDir, sourcePackageName);
const customMappingPath: string = path.resolve(customMappingDerivedPath);
const customMappingName: string = path.basename(customMappingDerivedPath);
const customizedPackagePath: string = path.resolve(packagesDir, `${sourcePackageName}-${customMappingName}`);

const { mapping: sourceMapping } = require(sourcePackagePath);
// TODO: resolve custom mapping
const customMapping = require(customMappingPath);

const customizationSchema: SchemaType = require(path.resolve(dssDir, 'schema/schema-customization.json'));

const validationOptions: Ajv.Options = {
  allErrors: true,
};
const ajv = new Ajv(validationOptions);
const validate: Ajv.ValidateFunction = ajv.compile(customizationSchema);
const fitsSchema: boolean | PromiseLike<boolean> = validate(customMapping);

if (!fitsSchema) {
  const errors: string[] = validate.errors.map((error: Ajv.ErrorObject): string => {
    return error.message;
  });
  const errorMessage: string = errors.join('\n*');

  console.error(`Please be advised to fix following errors:\n ${errorMessage}\n`);
  process.exit(1);
}

const mapping: SchemaType = customize(sourceMapping, customMapping);

const customizedPackageIndexPath: string = path.resolve(customizedPackagePath, 'index.ts');
const customizedPackageMappingPath: string = path.resolve(customizedPackagePath, 'mapping.json');

if (!existsSync(customizedPackagePath)) {
  mkdirSync(customizedPackagePath);
}

const indexOutput: string = [
  'export const mapping = require(\'./mapping.json\');',
].join('\n\n');

const mappingOutput: string = json(mapping);

writeFileSync(customizedPackageIndexPath, indexOutput);
writeFileSync(customizedPackageMappingPath, mappingOutput);
generateMappingPackage(customizedPackageIndexPath);

rimraf.sync(customizedPackagePath);


