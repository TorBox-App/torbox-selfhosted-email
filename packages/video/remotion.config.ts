import path from "node:path";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind";

Config.overrideWebpackConfig((currentConfiguration) => {
	const withTailwind = enableTailwind(currentConfiguration);

	return {
		...withTailwind,
		resolve: {
			...withTailwind.resolve,
			alias: {
				...(withTailwind.resolve?.alias ?? {}),
				"@": path.resolve(process.cwd(), "src"),
			},
		},
	};
});
