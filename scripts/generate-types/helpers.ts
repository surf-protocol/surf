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
		target.importsInternal.add(`${fieldType.defined},`)
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
	const externalImports = `${Object.values(target.importsExternal).join('\n')}\n`
	const internalImports =
		target.importsInternal.size > 0 && !forTypes
			? `import {\n\t${[...target.importsInternal].join('\n')}\n} from './types.js'\n\n`
			: ''
	const types = target.types.join('\n')

	return `${externalImports}\n${internalImports}${types}`
}

export const buildSeparator = (name: string) => `// ----------\n// ${name}\n// ----------\n`
