import { Command } from "commander";
import { EnvFile, EnvMapCompiled, EnvMap } from "./Types";
import { Parser } from "./compiler/Parser";
import { Compiler } from "./compiler/Compiler";
import { TemplateCompiler } from "./compiler/TemplateCompiler";
import { writeFile, readFile } from "./util/Filesystem";
import * as path from "path";

/**
 *
 */
export class EnvBuilder {
	private inputFiles: EnvFile[] = [];
	private inputLocalFiles: EnvFile[] = [];
	private templateFile: EnvFile = null;
	private contextFilename: string = null;

	setTemplate(file: EnvFile) {
		this.templateFile = file;
	}

	setContext(filename: string) {
		this.contextFilename = filename;
	}

	addFile(file: EnvFile) {
		this.inputFiles.push(file);
	}

	addLocalFile(file: EnvFile) {
		this.inputLocalFiles.push(file);
	}

	/**
	 * Read the data from a package.json
	 * @param pkgFile
	 * @param mode
	 */
	async readFromPackage(
		pkgFile: string | boolean,
		mode: string,
		packageModeRequired: boolean
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
		const result: any = {
			output: null
		};
		const data = JSON.parse(pkgContent);
		const envBuilderData = data["env-builder"] || {};
		if (envBuilderData.template) {
			this.setTemplate({
				filename: path.resolve(pkgDir, envBuilderData.template)
			});
		}
		if (envBuilderData.context) {
			this.setContext(path.resolve(pkgDir, envBuilderData.context));
		}
		if (envBuilderData.local) {
			const localFiles = [].concat(envBuilderData.local);
			for (const input of localFiles) {
				this.addLocalFile({ filename: path.resolve(pkgDir, input) });
			}
		}
		if (envBuilderData.output) {
			result.output = path.resolve(pkgDir, envBuilderData.output);
		}
		if (packageModeRequired) {
			const modes = envBuilderData.modes
				? Object.keys(envBuilderData.modes)
				: [];
			if (!mode || modes.indexOf(mode) < 0)
				throw new Error(
					`Mode is required required. Modes available: ${modes
						.map(m => `"${m}"`)
						.join(", ")}`
				);
		}
		if (envBuilderData.modes && envBuilderData.modes[mode]) {
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
	async compile(): Promise<EnvMapCompiled> {
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
		compiler.setContext(this.contextFilename);
		compiler.addMap(envMap);
		return compiler.compile();
	}

	/// Write the output to a file
	async write(filename: string) {
		const content = await this.output();
		await writeFile(filename, content);
	}

	/**
	 * Generate the output env file as a string
	 */
	async output(): Promise<string> {
		const env = await this.compile();
		if (this.templateFile) {
			const templateCompiler = new TemplateCompiler();
			const content = await templateCompiler.compile(
				this.templateFile,
				env
			);
			return content;
		}

		const output: string[] = [];
		for (const envName in env) {
			const envValue = env[envName];
			if (envValue === false) continue;
			output.push(`${envName}=${envValue}`);
		}
		return output.join("\n");
	}
	static async main(args: string[]) {
		const program = new Command();
		const collect = (b: string, a: string[]) => a.concat(b);
		program
			.command("generate [mode]")
			.option("--context <file>", "Context file to use")
			.option("-t, --template <file>", "Template file to use")
			.option("-i, --input <file>", "Input env file", collect, [])
			.option("--package-mode-required", "Force the use of a mode")
			.option(
				"-l, --local <file>",
				"Input local env file. Always the last input"
			)
			.option("-o, --output <file>", "Output file")
			.option(
				"-p, --package [file]",
				"Reads from the package.json",
				false
			)
			.option("--no-package", "Don't use a package.json")
			.action(async (mode, options) => {
				try {
					const builder = new EnvBuilder();

					const packageResult = await builder.readFromPackage(
						options.package,
						mode,
						options.packageModeRequired
					);
					if (options.context) {
						builder.setContext(options.context);
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
					let output = packageResult ? packageResult.output : null;
					if (options.output) output = options.output;
					if (output) {
						await builder.write(output);
					} else {
						console.log(await builder.output());
					}
				} catch (err) {
					console.error(err.message);
					process.exit(1);
				}
			});

		program.parse(args);
	}
}
