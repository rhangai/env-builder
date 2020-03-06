import { Command } from "commander";
import { EnvFile, EnvMapCompiled, EnvMap, EnvCompilationResult } from "./Types";
import { Parser } from "./compiler/Parser";
import { Compiler } from "./compiler/Compiler";
import { TemplateCompiler } from "./compiler/TemplateCompiler";
import { writeFile, readFile } from "./util/Filesystem";
import * as path from "path";
import { machineId } from "node-machine-id";
import { createHash } from "crypto";

/**
 *
 */
export class EnvBuilder {
	private inputFiles: EnvFile[] = [];
	private inputLocalFiles: EnvFile[] = [];
	private templateFile: EnvFile = null;
	private seedGetter: (envMap: EnvMap) => string = null;
	private envOverridePrefix: string = null;

	setTemplate(file: EnvFile) {
		this.templateFile = file;
	}

	setSeed(seed: string) {
		this.seedGetter = () => seed;
	}

	setSeedEnv(seedEnv: string) {
		this.seedGetter = env => {
			const envEntry = env[seedEnv];
			if (!envEntry) return null;
			if (!("value" in envEntry))
				throw new Error(`Env for seed must be constant`);
			return envEntry.value;
		};
	}

	addFile(file: EnvFile) {
		this.inputFiles.push(file);
	}

	addLocalFile(file: EnvFile) {
		this.inputLocalFiles.push(file);
	}

	setEnvOverridePrefix(envOverridePrefix: string) {
		this.envOverridePrefix = envOverridePrefix;
	}

	/**
	 * Read the data from a package.json
	 * @param pkgFile
	 * @param mode
	 */
	async readFromPackage(
		pkgFile: string | boolean,
		mode: string
	): Promise<null | any> {
		if (!pkgFile) return null;
		const isRequired = pkgFile != null;
		pkgFile = typeof pkgFile === "string" ? pkgFile : "package.json";
		pkgFile = path.resolve(pkgFile);
		const pkgDir = path.dirname(pkgFile);

		let pkgContent: string = null;
		try {
			pkgContent = await readFile(pkgFile);
		} catch (err) {
			pkgContent = null;
		}
		if (!pkgContent && isRequired) {
			throw new Error(`Package is required: ${pkgFile}`);
		}
		const result = {
			seed: null as string,
			output: [] as string[]
		};
		const data = JSON.parse(pkgContent);
		const envBuilderData = data["env-builder"] || {};
		if (envBuilderData.template) {
			this.setTemplate({
				filename: path.resolve(pkgDir, envBuilderData.template)
			});
		}
		if (envBuilderData.seed) {
			this.setSeed(envBuilderData.seed);
		} else {
			const seed = createHash("sha256")
				.update(`${data.name}|${await machineId()}`)
				.digest("hex");
			this.setSeed(seed);
		}
		if (envBuilderData.local) {
			const localFiles = [].concat(envBuilderData.local);
			for (const input of localFiles) {
				this.addLocalFile({ filename: path.resolve(pkgDir, input) });
			}
		}
		if (envBuilderData.output) {
			let outputs = [].concat(envBuilderData.output).filter(Boolean);
			result.output = outputs.map(o => path.resolve(pkgDir, o));
		}
		if (envBuilderData.modes) {
			mode = mode || "dev";
			const modes = envBuilderData.modes
				? Object.keys(envBuilderData.modes)
				: [];
			if (modes.indexOf(mode) < 0) {
				throw new Error(
					`Mode ${mode} does not exist. Modes available: ${modes
						.map(m => `"${m}"`)
						.join(", ")}`
				);
			}
			const inputFiles = [].concat(envBuilderData.modes[mode]);
			for (const input of inputFiles) {
				this.addFile({ filename: path.resolve(pkgDir, input) });
			}
		}
		return result;
	}

	/**
	 * Compile the env and returns the variables as a map
	 */
	async compile(): Promise<EnvCompilationResult> {
		let envMap: EnvMap = {};

		const inputFiles = []
			.concat(this.templateFile)
			.concat(this.inputFiles)
			.concat(this.inputLocalFiles)
			.filter(Boolean);
		for (const file of inputFiles) {
			const parser = new Parser();
			try {
				const inputEnvMap = await parser.parse(file);
				envMap = { ...envMap, ...inputEnvMap };
			} catch (err) {
				if (err.code === "ENOENT") continue;
				throw err;
			}
		}

		const compiler = new Compiler();
		compiler.setSeed(this.seedGetter ? this.seedGetter(envMap) : null);
		compiler.addMap(envMap);
		compiler.setEnvOverridePrefix(this.envOverridePrefix);
		return compiler.compile();
	}

	/// Write the output to a list of files
	async write(filenames: string[] | string) {
		const output = await this.output();
		filenames = [].concat(filenames).filter(Boolean);
		filenames = filenames.map(f => (f !== "-" ? path.resolve(f) : "-"));
		filenames = Array.from(new Set(filenames));

		const stdoutIndex = filenames.findIndex(f => f === "-");
		const hasStdout = stdoutIndex >= 0;
		if (hasStdout) {
			filenames.splice(stdoutIndex, 1);
		}
		for (const filename of filenames) {
			await writeFile(filename, output.content);
		}
		return { filenames, hasStdout, ...output };
	}

	/**
	 * Generate the output env file as a string
	 */
	async output(): Promise<EnvCompilationResult & { content: string }> {
		const { env, seed } = await this.compile();
		if (this.templateFile) {
			const templateCompiler = new TemplateCompiler();
			const content = await templateCompiler.compile(
				this.templateFile,
				env
			);
			return {
				env,
				seed,
				content: content
			};
		}

		const output: string[] = [];
		for (const envName in env) {
			const envValue = env[envName];
			if (envValue === false) continue;
			output.push(`${envName}=${envValue}`);
		}
		return {
			env,
			seed,
			content: output.join("\n")
		};
	}
	static async main(args: string[]) {
		const program = new Command();
		const collect = (b: string, a: string[]) => a.concat(b);
		program
			.command("generate [mode]")
			.option("-s, --seed <seed>", "The seed to use to generate the data")
			.option("-t, --template <file>", "Template file to use")
			.option("-i, --input <file>", "Input env file", collect, [])
			.option(
				"-l, --local <file>",
				"Input local env file. Always the last input"
			)
			.option("-o, --output <file>", "Output file", collect, [])
			.option(
				"-n, --dry-run",
				"Only prints the output without writing any file"
			)
			.option(
				"-p, --package [file]",
				"Reads from the package.json",
				false
			)
			.option("--no-package", "Don't use a package.json")
			.option(
				"--env-override-prefix <prefix>",
				"Sets a prefix to allow the variables to be overwritten by the current env. Useful for ci"
			)
			.action(async (mode, options) => {
				try {
					const builder = new EnvBuilder();

					const packageResult = await builder.readFromPackage(
						options.package,
						mode
					);
					if (options.seed) {
						builder.setSeed(options.seed);
					} else if (options.seedEnv) {
						builder.setSeedEnv(options.seedEnv);
					}
					if (options.template) {
						builder.setTemplate({ filename: options.template });
					}
					for (const inputFile of options.input) {
						builder.addFile({ filename: inputFile });
					}
					if (options.local) {
						builder.addFile({ filename: options.local });
					}
					if (options.envOverridePrefix) {
						builder.setEnvOverridePrefix(options.envOverridePrefix);
					}
					let output: string[] = [];
					if (packageResult)
						output = output.concat(packageResult.output);
					if (options.output) output = output.concat(options.output);
					output = output.filter(Boolean);
					if (options.dryRun) {
						output = ["-"];
					}

					const result = await builder.write(output);
					console.error(`Seed: ${result.seed}`);
					console.error(
						`Generated Env: ${result.filenames.join(";")}`
					);
					if (result.hasStdout) {
						console.error("");
						console.log(result.content);
						console.error("\n");
					}
				} catch (err) {
					console.error(err.message);
					process.exit(1);
				}
			});

		program.parse(args);
	}
}
