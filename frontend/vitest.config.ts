import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NEXT_PUBLIC_API_GATEWAY_URL: 'http://localhost:8000',
    },
  },
})
