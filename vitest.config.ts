import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: ['./tests/**/*.test.ts'],
		exclude: ['.pnp.cjs', '.pnp.loader.mjs', ...configDefaults.exclude],
		testTimeout: 1_000_000,
	},
})
