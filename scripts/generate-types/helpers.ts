import { IdlNumberType, Generated, IdlPredefinedTypes, IdlType, IdlField } from './types.js'

export const buildSeparator = (name: string) => `// ----------\n// ${name}\n// ----------\n`

export const indent = (content: string, count: number, nl?: boolean) =>
	`${'\t'.repeat(count)}${content}${nl ? '\n' : ''}`

export const transformNumberToTs = (type: IdlNumberType, generated: Generated) => {
	const numType = type[0]
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [_, bits] = type.split(numType)
	if (Number(bits) > 32) {
		generated.importsExternal['default bn.js'].push('BN')
		return 'BN'
	}
	return 'number'
}

export const transformPrimitiveToTs = (type: IdlPredefinedTypes, generated: Generated) => {
	switch (type) {
		case 'bool':
			return 'boolean'
		case 'bytes':
			return 'Uint8Array'
		case 'publicKey': {
			generated.importsExternal['@solana/web3.js'].push('PublicKey')
			return 'PublicKey'
		}
		case 'string':
			return 'string'
		default:
			return transformNumberToTs(type, generated)
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
		target.importsInternal['./types.js'].push(`${fieldType.defined}`)
		return fieldType.defined
	}
	if ('vec' in fieldType) {
		return `${getType(target, fieldType.vec)}[]`
	}
	if ('array' in fieldType) {
		return `${getType(target, fieldType.array[0])}[]`
	}
	if ('option' in fieldType) {
		return `${getType(target, fieldType.option)} | null`
	}
	if ('coption' in fieldType) {
		return `${getType(target, fieldType.coption)} | null`
	}
	console.error(`Unknown field type: ${fieldType}`)
	return ''
}

export const buildTypescriptType = (name: string, fields: IdlField[], generated: Generated) => {
	const typeDef = `export type ${name} = `
	const propsArr = fields.map(
		(fieldType) => `${fieldType.name}: ${getType(generated, fieldType.type)}`,
	)
	const propsStr = propsArr.join('\n\t')
	return `${typeDef}{\n\t${propsStr}\n}\n`
}

export const buildAccountParser = (capitalizedName: string, typeName: string) => {
	const parserName = `parse${typeName}`
	return (
		`export const ${parserName} = (program: Program<SurfIDL>, data: Buffer | null) => {\n` +
		indent('if (!data) {', 1, true) +
		indent('return null', 2, true) +
		indent('}', 1, true) +
		indent('try {', 1, true) +
		indent(
			`return program.coder.accounts.decode('${capitalizedName}', data) as ${typeName}`,
			2,
			true,
		) +
		indent('} catch {', 1, true) +
		indent(`console.error('Account ${capitalizedName} could not be parsed')`, 2, true) +
		indent('return null', 2, true) +
		indent('}', 1, true) +
		'}\n'
	)
}

export const composeFile = (generated: Generated, forTypes?: boolean) => {
	const composeImports = (imports: Record<string, string[]>) => {
		const importsArr = Object.entries(imports)
		if (importsArr.every(([_, i]) => !i.length)) {
			return ''
		}
		return (
			importsArr
				.map(([path, _imports]) => {
					const [isDefault, realPath] = path.split(' ')
					if (isDefault.length && realPath && _imports.length) {
						return `import ${_imports[0]} from '${realPath}'`
					}

					const importsUnique = [...new Set(_imports)]
					return importsUnique.length
						? `import { ${importsUnique.join(', ')} } from '${path}'`
						: null
				})
				.filter(Boolean)
				.join('\n') + '\n\n'
		)
	}

	const importsExternal = composeImports(generated.importsExternal)
	const importsInternal = composeImports(generated.importsInternal)

	let output = ''
	output += forTypes ? '/* eslint-disable no-use-before-define */\n' : ''
	output += importsExternal
	output += !forTypes ? importsInternal : ''
	output += generated.output.join('\n')

	return output
}
