import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: [...process.env.TEST_FILES.split(',')],
		exclude: configDefaults.exclude,
		testTimeout: 1_000_000,
	},
})
