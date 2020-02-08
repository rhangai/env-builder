import { Command } from "commander";
import { EnvFile, EnvMapCompiled, EnvMap } from "./Types";
import { Parser } from "./compiler/Parser";
import { Compiler } from "./compiler/Compiler";
import { TemplateCompiler } from "./compiler/TemplateCompiler";
import { writeFile } from "./util/Filesystem";

/**
 *
 */
export class EnvBuilder {
	private inputFiles: EnvFile[] = [];
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

	async compile(): Promise<EnvMapCompiled> {
		let envMap: EnvMap = {};
		for (const file of this.inputFiles) {
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

	async write(filename: string) {
		const content = await this.output();
		await writeFile(filename, content);
	}

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
			.command("generate", { isDefault: true })
			.option("--context [file]", "Context file to use")
			.option("-t, --template [file]", "Template file to use")
			.option("-i, --input [file]", "Input env file", collect, [])
			.option("-o, --output [file]", "Output file")
			.action(async options => {
				const builder = new EnvBuilder();
				if (options.context) {
					builder.setContext(options.context);
				}
				if (options.template) {
					builder.addFile({ filename: options.template });
					builder.setTemplate({ filename: options.template });
				}
				for (const inputFile of options.input) {
					builder.addFile({ filename: inputFile });
				}
				if (options.output) {
					await builder.write(options.output);
				} else {
					console.log(await builder.output());
				}
			});

		program.parse(args);
	}
}
