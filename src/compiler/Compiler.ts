import { runInNewContext } from "vm";
import {
	EnvEntry,
	EnvMap,
	EnvMapCompiled,
	EnvFile,
	EnvCompilationResult
} from "../Types";
import { DepGraph } from "dependency-graph";
import { CompilerContext } from "./CompilerContext";

/**
 * Compile the environment variables
 */
export class Compiler {
	private envMap: EnvMap = {};
	private seed: string;
	private context: CompilerContext = new CompilerContext();
	private envOverridePrefix: string = null;

	/// Set the context
	setSeed(seed: string) {
		this.seed = seed;
	}

	/// Set the Env Override Prefix
	setEnvOverridePrefix(envOverridePrefix: string) {
		this.envOverridePrefix = envOverridePrefix;
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
	async compile(): Promise<EnvCompilationResult> {
		await this.context.setup(this.seed);

		let currentEnv: EnvMapCompiled = {};
		const expressionMap: { [key: string]: string } = {};
		const stringValueEnvs: string[] = [];

		for (const envName in this.envMap) {
			const entry = this.envMap[envName];
			if (!entry) continue;

			// Override the environment using the variables from the current env but prefixed
			if (this.envOverridePrefix) {
				const overrideEnvName = `${this.envOverridePrefix}${envName}`;
				if (overrideEnvName in process.env) {
					currentEnv[envName] = process.env[overrideEnvName];
					continue;
				}
			}
			if ("value" in entry) {
				currentEnv[envName] = entry.value;
				stringValueEnvs.push(envName);
			} else if (entry.expression) {
				expressionMap[envName] = entry.expression;
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

		return {
			env: currentEnv,
			seed: this.context.getSeed()
		};
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
		if (result == null) return '';
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
