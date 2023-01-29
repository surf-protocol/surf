/* eslint-disable no-use-before-define */
export type IdlTypeDefined = {
	defined: string
}
export type IdlTypeOption = {
	option: IdlType
}
export type IdlTypeCOption = {
	coption: IdlType
}
export type IdlTypeVec = {
	vec: IdlType
}
export type IdlTypeArray = {
	array: [idlType: IdlType, size: number]
}
/* eslint-enable no-use-before-define */
export type IdlNumberType =
	| 'u8'
	| 'i8'
	| 'u16'
	| 'i16'
	| 'u32'
	| 'i32'
	| 'f32'
	| 'u64'
	| 'i64'
	| 'f64'
	| 'u128'
	| 'i128'
	| 'u256'
	| 'i256'
export type IdlPredefinedTypes = IdlNumberType | 'bool' | 'bytes' | 'string' | 'publicKey'
export type IdlType =
	| IdlPredefinedTypes
	| IdlTypeDefined
	| IdlTypeOption
	| IdlTypeCOption
	| IdlTypeVec
	| IdlTypeArray
export type IdlField = { name: string; type?: IdlType }

export type Generated = {
	output: string[]
} & Record<'importsExternal' | 'importsInternal', Record<string, string[]>>
