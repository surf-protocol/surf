import { Idl } from '@coral-xyz/anchor'
import fs from 'node:fs'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildAccountParser, buildSeparator, buildTypescriptType, composeFile } from './helpers.js'
import {
	composeAccountsType,
	composeParamsType,
	composeInstructionFunction,
	composeArgs,
} from './instructions.js'
import { Generated } from './types.js'

const IDL_FILE_NAME = 'surf'

// scripts/dist/generate-types
const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_RELATIVE_PATH = '../../../'
const SDK_TYPES_PATH = path.join(__dirname, SRC_RELATIVE_PATH, './sdk/ts/src/idl')
const SRC_IDL_JSON_PATH = path.join(
	__dirname,
	SRC_RELATIVE_PATH,
	`./target/idl/${IDL_FILE_NAME}.json`,
)

const IDL_TYPE_NAME = IDL_FILE_NAME[0].toUpperCase() + IDL_FILE_NAME.slice(1).toLowerCase() + 'IDL'
const IDLFile = fs.readFileSync(SRC_IDL_JSON_PATH, { encoding: 'utf-8' })
const IDLParsed = JSON.parse(IDLFile) as Idl

const generatedTypes: Generated = {
	importsExternal: {
		'default bn.js': [],
		'@solana/web3.js': [],
	},
	importsInternal: { './types.js': [], './state-accounts.js': [] },
	output: [],
}
const generatedAccounts: Generated = {
	importsExternal: {
		'@solana/web3.js': [],
		'@coral-xyz/anchor': ['Program'],
		'default bn.js': [],
	},
	importsInternal: {
		'./types.js': [],
		'./state-accounts.js': [],
		[`./${IDL_FILE_NAME}-idl.js`]: [IDL_TYPE_NAME],
	},
	output: [],
}
const generatedInstructions: Generated = {
	importsExternal: {
		'@solana/web3.js': ['PublicKey'],
		'@coral-xyz/anchor': ['Program'],
		'default bn.js': [],
	},
	importsInternal: {
		'./types.js': [],
		'./state-accounts.js': [],
		[`./${IDL_FILE_NAME}-idl.js`]: [IDL_TYPE_NAME],
	},
	output: [],
}

IDLParsed.types?.forEach(({ name, type }) => {
	const fields = type.kind === 'enum' ? type.variants : type.fields
	generatedTypes.output.push(buildTypescriptType(name, fields, generatedTypes))
})
IDLParsed.accounts?.forEach(({ name, type }) => {
	const typeName = `${name}Account`
	generatedAccounts.output.push(buildTypescriptType(typeName, type.fields, generatedAccounts))
	generatedAccounts.output.push(buildAccountParser(name, typeName))
})
IDLParsed.instructions?.forEach(({ name, accounts, args }) => {
	const capitalizedName = `${name[0].toUpperCase()}${name.slice(1)}`

	const hasAccounts = accounts.length > 0
	const hasArgs = args.length > 0

	const accountsType = composeAccountsType(accounts, capitalizedName)
	const { type: argsType, argsNames } = composeArgs(args, capitalizedName, generatedInstructions)
	const paramsType = composeParamsType({ hasAccounts, hasArgs, ixNameCapitalized: capitalizedName })
	const ixFunction = composeInstructionFunction({
		ixName: name,
		ixNameCapitalized: capitalizedName,
		idlTypeName: IDL_TYPE_NAME,
		hasAccounts,
		hasArgs,
		argsNames,
	})

	let output = buildSeparator(name)
	output += accountsType
	output += argsType
	output += paramsType
	output += ixFunction

	generatedInstructions.output.push(output)
})

try {
	fs.rmSync(SDK_TYPES_PATH, { recursive: true })
} catch {}

const files = [
	{
		generate: generatedTypes.output.length > 1,
		name: 'types',
		generated: generatedTypes,
	},
	{
		generate: generatedAccounts.output.length > 1,
		name: 'state-accounts',
		generated: generatedAccounts,
	},
	{
		generate: generatedInstructions.output.length > 0,
		name: 'instructions',
		generated: generatedInstructions,
	},
]

if (files.some(({ generate }) => generate)) {
	fs.mkdirSync(SDK_TYPES_PATH, { recursive: true })
}

fs.writeFileSync(
	path.join(SDK_TYPES_PATH, `./${IDL_FILE_NAME}-idl.ts`),
	`export type ${IDL_TYPE_NAME} = ${IDLFile}`,
)

files.forEach(({ generate, name, generated }) => {
	if (generate) {
		fs.writeFileSync(
			path.join(SDK_TYPES_PATH, `./${name}.ts`),
			composeFile(generated, name === 'types'),
		)
	}
})
