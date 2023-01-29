import { IdlNumberType, Generated, IdlPredefinedTypes, IdlType, IdlField } from './types.js'

export const transformNumberToTs = (type: IdlNumberType, target: Generated) => {
	const numType = type[0]
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [_, bits] = type.split(numType)
	if (Number(bits) > 32) {
		target.importsExternal['BN'] = "import BN from 'bn.js'"
		return 'BN'
	}
	return 'number'
}

export const transformPrimitiveToTs = (type: IdlPredefinedTypes, target: Generated) => {
	switch (type) {
		case 'bool':
			return 'boolean'
		case 'bytes':
			return 'Uint8Array'
		case 'publicKey': {
			target.importsExternal['@solana/web3.js'] = "import { PublicKey } from '@solana/web3.js'"
			return 'PublicKey'
		}
		case 'string':
			return 'string'
		default:
			return transformNumberToTs(type, target)
	}
}

export const getType = (target: Generated, fieldType?: IdlType): string => {
	if (typeof fieldType === 'string') {
		return transformPrimitiveToTs(fieldType, target)
	}
	if (!fieldType) {
		return 'Record<string, never>'
	}
	if ('defined' in fieldType) {
		target.importsInternal['./types.js'].push(`${fieldType.defined},`)
		return fieldType.defined
	}
	if ('vec' in fieldType) {
		return `${getType(target, fieldType.vec)}[]`
	}
	if ('array' in fieldType) {
		return `${getType(target, fieldType.array[0])}[]`
	}
	// TODO: option, coption, enums with values
	return ''
}

export const buildTypescriptType = (name: string, fields: IdlField[], target: Generated) => {
	const typeDef = `export type ${name} = `
	const propsArr = fields.map(
		(fieldType) => `${fieldType.name}: ${getType(target, fieldType.type)}`,
	)
	const propsStr = propsArr.join('\n\t')
	return `${typeDef}{\n\t${propsStr}\n}\n`
}

export const composeFile = (target: Generated, forTypes?: boolean) => {
	const importsExternal = Object.values(target.importsExternal)
	const importsInternal = Object.entries(target.importsInternal)
		.map(([path, imports]) =>
			imports.length ? `import {\n${imports.map((i) => `\t${i},\n`).join()}} from '${path}'` : null,
		)
		.filter(Boolean)

	return (
		(forTypes ? '/* eslint-disable no-use-before-define */\n' : '') +
		[
			importsExternal.length ? `${importsExternal.join('\n')}\n` : null,
			!forTypes && importsInternal.length ? `${importsInternal.join('\n')}\n` : null,
			target.output.join('\n'),
		]
			.filter(Boolean)
			.join('\n')
	)
}

export const buildSeparator = (name: string) => `// ----------\n// ${name}\n// ----------\n`

export const indent = (content: string, count: number, nl?: boolean) =>
	`${'\t'.repeat(count)}${content}${nl ? '\n' : ''}`
