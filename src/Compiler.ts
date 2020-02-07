import { runInNewContext } from "vm";
import { EnvEntry, EnvMap, EnvMapCompiled } from "./Types";

/**
 * Compile the environment variables
 */
export class Compiler {
	private envMap: EnvMap = {};

	/// Add a new variable to be compiled
	add(key: string, entry: EnvEntry) {
		this.envMap[key] = entry;
	}

	/// Add a new variable to be compiled
	addMap(map: EnvMap) {
		for (const key in map) {
			this.add(key, map[key]);
		}
	}

	/// Compile the variables
	async compile(): Promise<EnvMapCompiled> {
		const currentEnv: EnvMapCompiled = {};
		const expressionMap: { [key: string]: string } = {};
		for (const key in this.envMap) {
			const entry = this.envMap[key];
			if (!entry) continue;
			if ("value" in entry) {
				currentEnv[key] = entry.value;
			} else if (entry.expression) {
				expressionMap[key] = entry.expression;
			}
		}

		for (const key in expressionMap) {
			const value = await this.compileExpression(
				currentEnv,
				expressionMap[key]
			);
			currentEnv[key] = value;
		}
		return currentEnv;
	}

	/// Compile a single expression
	private async compileExpression(
		env: EnvMapCompiled,
		expression: string
	): Promise<string | false> {
		const context = {
			env: { ...env }
		};
		const result = await runInNewContext(expression, context);
		if (result === false) return false;
		return `${result}`;
	}
}
