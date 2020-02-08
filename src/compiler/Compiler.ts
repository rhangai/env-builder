import { runInNewContext } from "vm";
import { EnvEntry, EnvMap, EnvMapCompiled, EnvFile } from "../Types";
import { DepGraph } from "dependency-graph";
import { CompilerContext } from "./CompilerContext";

/**
 * Compile the environment variables
 */
export class Compiler {
	private envMap: EnvMap = {};
	private contextFilename: string;
	private context: CompilerContext = new CompilerContext();

	/// Set the context
	setContext(filename: string) {
		this.contextFilename = filename;
	}

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
		await this.context.setup(this.contextFilename);

		let currentEnv: EnvMapCompiled = {};
		const expressionMap: { [key: string]: string } = {};
		const stringValueEnvs: string[] = [];

		for (const key in this.envMap) {
			const entry = this.envMap[key];
			if (!entry) continue;
			if ("value" in entry) {
				currentEnv[key] = entry.value;
				stringValueEnvs.push(key);
			} else if (entry.expression) {
				expressionMap[key] = entry.expression;
			}
		}

		// Compile every env expression
		for (const envName in expressionMap) {
			const value = await this.compileExpression(
				currentEnv,
				envName,
				expressionMap[envName]
			);
			currentEnv[envName] = value;
		}

		// Compile every string value environment variable
		currentEnv = await this.compileStringValues(
			currentEnv,
			stringValueEnvs
		);

		return currentEnv;
	}

	/// Compile a single expression
	private async compileExpression(
		env: EnvMapCompiled,
		envName: string,
		expression: string
	): Promise<string | false> {
		const context = await this.context.create(env, envName);
		const result = await runInNewContext(expression, context);
		if (result === false) return false;
		return `${result}`;
	}
	/// Compile a single value
	private async compileStringValues(
		env: EnvMapCompiled,
		envList: string[]
	): Promise<EnvMapCompiled> {
		env = { ...env };

		// Create the nodes as every env
		const depGraph = new DepGraph();
		for (const envName in env) {
			depGraph.addNode(envName);
		}

		const envReplaces: { [key: string]: string[] } = {};

		// Get every dependency by checking for the environment variables
		for (const envName of envList) {
			const envValue = env[envName];
			if (envValue === false) continue;
			const matches = envValue.match(/\$\{[a-zA-Z0-9_]+\}/g);
			if (!matches) continue;

			for (const match of matches) {
				const matchEnvName = match.substr(2, match.length - 3);
				if (!depGraph.hasNode(matchEnvName)) continue;
				depGraph.addDependency(envName, matchEnvName);
				envReplaces[envName] = envReplaces[envName] || [];
				envReplaces[envName].push(matchEnvName);
			}
		}

		// Replaces the variables using the dependency order
		const overallOrder = depGraph.overallOrder();
		for (const envName of overallOrder) {
			let envValue = env[envName];
			if (envValue === false) continue;
			const replaces = envReplaces[envName];
			if (!replaces) continue;
			for (const dependencyEnvName of replaces) {
				const dependencyEnvValue = env[dependencyEnvName];
				if (dependencyEnvValue === false) continue;
				envValue = envValue.replace(
					"${" + dependencyEnvName + "}",
					dependencyEnvValue
				);
			}
			env[envName] = envValue;
		}
		return env;
	}
}
