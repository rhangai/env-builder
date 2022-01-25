import { EnvMapCompiled, EnvFile } from "../Types";
import { readFile } from "../util/Filesystem";

/**
 *
 */
export class TemplateCompiler {
	async compile(file: EnvFile, env: EnvMapCompiled): Promise<string> {
		let content: string | null = null;
		if ("filename" in file) {
			content = await readFile(file.filename);
		} else if ("content" in file) {
			content = file.content;
		}
		if (content === null) throw new Error(`Invalid file`);
		return this.compileContent(content, env);
	}

	private async compileContent(
		content: string,
		env: EnvMapCompiled
	): Promise<string> {
		const lines = content.split(/\n/);
		const output: string[] = [];

		const usedEnvs: { [key: string]: true } = {};
		for (const line of lines) {
			const envLine = this.parseEnvLine(line);
			if (!envLine) {
				output.push(line);
				continue;
			}

			const envName = envLine.key;
			const envValue = env[envName];
			usedEnvs[envName] = true;
			if (envValue !== false) {
				output.push(`${envName}=${env[envName]}`);
			}
		}

		let hasOtherVars = false;
		for (const envName in env) {
			const envValue = env[envName];
			if (!usedEnvs[envName]) {
				if (!hasOtherVars) {
					output.push("");
					output.push("# Other vars");
				}
				hasOtherVars = true;
				if (envValue !== false) {
					output.push(`${envName}=${this.formatEnvValue(envValue)}`);
				}
			}
		}
		return output.join("\n");
	}

	private formatEnvValue(value: string) {
		if (value.includes("#") || value.includes('"')) {
			return JSON.stringify(value);
		}
		return value;
	}

	private parseEnvLine(line: string) {
		line = line.trim();
		const lineMatch = line.match(/^([a-zA-Z0-9_]+)\s*\=/);
		if (lineMatch) {
			return { key: lineMatch[1] };
		}
		return false;
	}
}
