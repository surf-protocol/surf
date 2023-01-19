import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: ['./tests/order.ts'],
		exclude: ['.pnp.cjs', '.pnp.loader.mjs', ...configDefaults.exclude],
		testTimeout: 1_000_000,
	},
})
