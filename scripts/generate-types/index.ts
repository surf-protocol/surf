import { Idl } from '@coral-xyz/anchor'
import fs from 'node:fs'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSeparator, buildTypescriptType, composeFile, getType } from './helpers.js'
import { Generated } from './types.js'

// scripts/dist/generate-types
const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_RELATIVE_PATH = '../../../'
const SDK_TYPES_PATH = path.join(__dirname, SRC_RELATIVE_PATH, './sdk/ts/src/types')
const IDL_PATH = path.join(__dirname, SRC_RELATIVE_PATH, './target/idl/surf.json')

const IDLFile = fs.readFileSync(IDL_PATH, { encoding: 'utf-8' })
const IDLParsed = JSON.parse(IDLFile) as Idl

const generatedTypes: Generated = {
	importsExternal: {},
	importsInternal: new Set(),
	types: [buildSeparator('TYPES')],
}
const generatedAccounts: Generated = {
	importsExternal: {},
	importsInternal: new Set(),
	types: [buildSeparator('STATE ACCOUNTS')],
}
const generatedInstructions: Generated = {
	importsExternal: { '@solana/web3.js': "import { PublicKey } from '@solana/web3.js'" },
	importsInternal: new Set(),
	types: [],
}

IDLParsed.types?.forEach(({ name, type }) => {
	const fields = type.kind === 'enum' ? type.variants : type.fields
	generatedTypes.types.push(buildTypescriptType(name, fields, generatedTypes))
})
IDLParsed.accounts?.forEach(({ name, type }) => {
	generatedAccounts.types.push(buildTypescriptType(`${name}Account`, type.fields, generatedAccounts))
})
IDLParsed.instructions?.forEach(({ name, accounts, args }) => {
	if (accounts.length || args.length) {
		generatedInstructions.types.push(buildSeparator(name))
	}

	if (accounts.length) {
		const accountsProps = accounts.map(({ name: accountName }) => {
			return `${accountName}: PublicKey`
		})
		const accountsType = `export type ${name}IxAccounts = {\n\t${accountsProps.join('\n\t')}\n}\n`
		generatedInstructions.types.push(accountsType)
	}

	if (args.length) {
		const argsProps = args.map(({ type, name: argName }) => {
			return `${argName}: ${getType(generatedInstructions, type)}`
		})
		const argsType = `export type ${name}IxArgs = {\n\t${argsProps.join('\n\t')}\n}\n`
		generatedInstructions.types.push(argsType)
	}
})

fs.rmSync(SDK_TYPES_PATH, { recursive: true })

const files = [
	{
		generate: generatedTypes.types.length > 1,
		name: 'types',
		generated: generatedTypes,
	},
	{
		generate: generatedAccounts.types.length > 1,
		name: 'state-accounts',
		generated: generatedAccounts,
	},
	{
		generate: generatedInstructions.types.length > 0,
		name: 'instructions-accounts',
		generated: generatedInstructions,
	},
]

if (files.some(({ generate }) => generate)) {
	fs.mkdirSync(SDK_TYPES_PATH, { recursive: true })
}

files.forEach(({ generate, name, generated }) => {
	if (generate) {
		fs.writeFileSync(
			path.join(SDK_TYPES_PATH, `./${name}.ts`),
			composeFile(generated, name === 'types'),
		)
	}
})
