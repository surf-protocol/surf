import { indent, getType } from './helpers.js'
import { Generated, IdlType } from './types.js'

const getAccountsTypeName = (ixNameCapitalized: string) => `${ixNameCapitalized}IxAccounts`
const getArgsTypeName = (ixNameCapitalized: string) => `${ixNameCapitalized}IxArgs`
const getParamsTypeName = (ixNameCapitalized: string) => `${ixNameCapitalized}IxParams`

export const composeAccountsType = (accounts: { name: string }[], ixNameCapitalized: string) => {
	let accountsProps = ''
	accounts.forEach(({ name: accountName }) => {
		accountsProps += indent(`${accountName}: PublicKey`, 1, true)
	})
	return accounts.length
		? `\nexport type ${getAccountsTypeName(ixNameCapitalized)} = {\n${accountsProps}}\n`
		: ''
}

export const composeArgs = (
	args: { name: string; type: IdlType }[],
	ixNameCapitalized: string,
	generated: Generated,
) => {
	let argsNames = ''
	let argsProps = ''
	args.forEach(({ type, name: argName }) => {
		argsNames += indent(`args.${argName},`, 3, true)
		argsProps += indent(`${argName}: ${getType(generated, type)}`, 1, true)
	})
	return {
		argsNames: args.length ? `\n${argsNames}\t\t` : '',
		type: args.length
			? `\nexport type ${getArgsTypeName(ixNameCapitalized)} = {\n${argsProps}}\n`
			: '',
	}
}

type ComposeParamsTypeParams = {
	hasAccounts: boolean
	hasArgs: boolean
	ixNameCapitalized: string
}

export const composeParamsType = ({
	hasAccounts,
	hasArgs,
	ixNameCapitalized,
}: ComposeParamsTypeParams) => {
	let props = ''
	if (hasAccounts) {
		props += indent(`accounts: ${getAccountsTypeName(ixNameCapitalized)}`, 1, true)
	}
	if (hasArgs) {
		props += indent(`args: ${getArgsTypeName(ixNameCapitalized)}`, 1, true)
	}
	return props.length ? `\nexport type ${ixNameCapitalized}IxParams = {\n${props}}\n` : ''
}

type ComposeInstructionFunctionParams = {
	ixName: string
	ixNameCapitalized: string
	idlTypeName: string
	hasAccounts: boolean
	hasArgs: boolean
	argsNames: string
}

export const composeInstructionFunction = ({
	ixName,
	ixNameCapitalized,
	idlTypeName,
	hasAccounts,
	hasArgs,
	argsNames,
}: ComposeInstructionFunctionParams) => {
	const functionParamsNames: string[] = []
	if (hasAccounts) {
		functionParamsNames.push('accounts')
	}
	if (hasArgs) {
		functionParamsNames.push('args')
	}

	const functionParams = !functionParamsNames.length
		? ''
		: `, { ${functionParamsNames.join(', ')} }: ${getParamsTypeName(ixNameCapitalized)}`
	const functionName = `build${ixNameCapitalized}Ix`

	let output = `\nexport const ${functionName} = async (program: Program<${idlTypeName}>${functionParams}) => {\n`
	output += indent(`const ix = await program.methods\n${indent(`.${ixName}`, 2)}(`, 1)
	output += `${argsNames})\n`
	output += hasAccounts ? indent('.accountsStrict(accounts)', 2, true) : ''
	output += indent('.instruction()', 2, true)
	output += indent('return ix', 1, true)
	output += '}\n'

	return output
}
