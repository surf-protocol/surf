import { Idl } from '@coral-xyz/anchor'
import fs from 'node:fs'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
	buildAccountParser,
	buildSeparator,
	buildTypescriptType,
	composeFile,
	getType,
	indent,
} from './helpers.js'
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
	importsExternal: {},
	importsInternal: { './types.js': [], './state-accounts.js': [] },
	output: [],
}
const generatedAccounts: Generated = {
	importsExternal: {
		'@solana/web3.js': "import { AccountInfo } from '@solana/web3.js'",
		'@coral-xyz/anchor': "import { Program } from '@coral-xyz/anchor'",
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
		'@solana/web3.js': "import { PublicKey } from '@solana/web3.js'",
		'@coral-xyz/anchor': "import { Program } from '@coral-xyz/anchor'",
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
	const accountsTypeName = `${capitalizedName}IxAccounts`
	const argsTypeName = `${capitalizedName}IxArgs`
	const paramsTypeName = `${capitalizedName}IxParams`

	const composeAccountsType = () => {
		const accountsProps = accounts.reduce((acc, { name: accountName }) => {
			return acc + indent(`${accountName}: PublicKey`, 1, true)
		}, '')
		return `\nexport type ${accountsTypeName} = {\n${accountsProps}}\n`
	}

	const composeArgsType = () => {
		const argsNames: string[] = []
		let argsProps = ''
		args.forEach(({ type, name: argName }) => {
			argsNames.push(`args.${argName},`)
			argsProps += indent(`${argName}: ${getType(generatedInstructions, type)}`, 1, true)
		})
		return {
			argsNames,
			type: `\nexport type ${argsTypeName} = {\n${argsProps}}\n`,
		}
	}

	const composeParamsType = () => {
		let props = ''
		if (accounts.length) {
			props += indent(`accounts: ${accountsTypeName}`, 1, true)
		}
		if (args.length) {
			props += indent(`args: ${argsTypeName}`, 1, true)
		}
		return props.length ? `\nexport type ${paramsTypeName} = {\n${props}}\n` : ''
	}

	const composeInstructionFunction = (argsNames: string[]) => {
		const functionParamsNames: string[] = []
		if (accounts.length) {
			functionParamsNames.push('accounts')
		}
		if (args.length) {
			functionParamsNames.push('args')
		}
		const functionParams = !functionParamsNames.length
			? ''
			: `, { ${functionParamsNames.join(', ')} }: ${paramsTypeName}`

		const functionName = `build${capitalizedName}Ix`
		return (
			`\nexport const ${functionName} = async (program: Program<${IDL_TYPE_NAME}>${functionParams}) => {\n` +
			indent(`const ix = await program.methods\n${indent(`.${name}`, 2)}(`, 1) +
			(argsNames.length ? `\n${argsNames.map((n) => indent(n, 3, true)).join('')}\t\t` : '') +
			')\n' +
			(accounts.length ? indent('.accountsStrict(accounts)', 2, true) : '') +
			indent('.instruction()', 2, true) +
			indent('return ix', 1, true) +
			'}\n'
		)
	}

	const accountsType = composeAccountsType()
	const { type: argsType, argsNames } = composeArgsType()
	const paramsType = composeParamsType()
	const ixFunction = composeInstructionFunction(argsNames)

	const output =
		`${buildSeparator(name)}` +
		(accounts.length ? accountsType : '') +
		(args.length ? argsType : '') +
		paramsType +
		ixFunction

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
