import { EnvMap, EnvEntry, EnvFile } from "./Types";
import { parse as envParse } from "dotenv";
import { readFile } from "fs-extra";

/**
 * Parse envfiles
 */
export class Parser {
	async parse(file: EnvFile): Promise<EnvMap> {
		let content: string = null;
		if ("filename" in file) {
			content = await readFile(file.filename, "utf8");
		} else if ("content" in file) {
			content = file.content;
		}
		if (content === null) throw new Error(`Invalid file`);
		return this.parseContent(content);
	}

	private async parseContent(content: string): Promise<EnvMap> {
		const envs = envParse(content);
		const envMap: EnvMap = {};
		for (const key in envs) {
			const envValue = envs[key];
			const envEntry = this.parseEnvValue(envValue);
			envMap[key] = envEntry;
		}
		return envMap;
	}

	private parseEnvValue(value: string): EnvEntry {
		value = value.trim();
		if (value.substr(0, 2) === "{{" && value.substr(-2) === "}}") {
			return { expression: value.substr(2, value.length - 4) };
		}
		return { value };
	}
}
