import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['packages/**/tests/**/*.test.ts', 'labs/**/tests/**/*.test.ts', 'apps/teacher-dashboard/tests/**/*.test.ts'], environment: 'node' },
});
