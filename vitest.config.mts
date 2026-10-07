import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resuelve el alias "@/..." de tsconfig.json
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    // Ningún test debe depender del .env local ni hacer llamadas externas
    env: {
      NODE_ENV: "test",
    },
  },
});
