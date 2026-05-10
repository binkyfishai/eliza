declare module "@elizaos/plugin-discord" {
	import type { Plugin } from "@elizaos/core";

	const plugin: Plugin;
	export default plugin;
	export const elizaPlugin: Plugin;
}

declare module "@elizaos/plugin-local-embedding" {
	import type { Plugin } from "@elizaos/core";

	const plugin: Plugin;
	export default plugin;
	export const elizaPlugin: Plugin;
}

declare module "@elizaos/plugin-telegram" {
	import type { Plugin } from "@elizaos/core";

	const plugin: Plugin;
	export default plugin;
	export const elizaPlugin: Plugin;
}

declare module "nodemailer" {
	export function createTransport(options: unknown): {
		sendMail(message: unknown): Promise<unknown>;
	};
}
