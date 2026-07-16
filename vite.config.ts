import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import pkg from "./package.json";

export default defineConfig({
	plugins: [react()],
	build: {
		lib: {
			entry: {
				index: resolve(__dirname, "src/index.ts"),
				ui: resolve(__dirname, "src/ui/index.ts"),
				state: resolve(__dirname, "src/state/index.ts"),
				performance: resolve(__dirname, "src/performance/index.ts"),
				events: resolve(__dirname, "src/events/index.ts"),
			},
			name: "HimanshuSorathiyaReactKit",
			formats: ["es"],
		},
		rollupOptions: {
			external: [
				...Object.keys(
					(pkg as { dependencies?: Record<string, string> }).dependencies
						|| {},
				),
				...Object.keys(
					(pkg as { peerDependencies?: Record<string, string> })
						.peerDependencies || {},
				),
				"react",
				"react-dom",
				"react/jsx-runtime",
			],
			output: {
				assetFileNames: "[name][extname]",
				chunkFileNames: "[name].js",
				exports: "named",
			},
		},
	},
});
