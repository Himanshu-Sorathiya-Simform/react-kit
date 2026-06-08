import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import pkg from "./package.json";

export default defineConfig({
	plugins: [
		react(),
		dts({
			insertTypesEntry: true,
		}),
	],
	build: {
		lib: {
			entry: resolve(__dirname, "src/index.ts"),
			name: "HimanshuSorathiyaReactKit",
			formats: ["es"],
			fileName: "index",
		},
		rollupOptions: {
			external: [
				...Object.keys(pkg.dependencies || {}),
				...Object.keys(pkg.peerDependencies || {}),
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
