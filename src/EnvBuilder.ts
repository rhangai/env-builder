import { Command } from "commander";
import { EnvFile, EnvMapCompiled, EnvMap } from "./Types";
import { Parser } from "./Parser";
import { Compiler } from "./Compiler";
import { Template } from "./Template";
import { writeFile } from "fs-extra";

/**
 *
 */
export class EnvBuilder {
	private inputFiles: EnvFile[] = [];
	private templateFile: EnvFile = null;

	setTemplate(file: EnvFile) {
		this.templateFile = file;
	}

	addFile(file: EnvFile) {
		this.inputFiles.push(file);
	}

	async compile(): Promise<EnvMapCompiled> {
		let envMap: EnvMap = {};
		for (const file of this.inputFiles) {
			const parser = new Parser();
			const inputEnvMap = await parser.parse(file);
			envMap = { ...envMap, ...inputEnvMap };
		}

		const compiler = new Compiler();
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
			const template = new Template();
			const content = await template.transpile(this.templateFile, env);
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
			.command("generate")
			.option("-t, --template [file]", "Template file to use")
			.option("-i, --input [file]", "Input env file", collect, [])
			.option("-o, --output [file]", "Output file")
			.action(async options => {
				const builder = new EnvBuilder();
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
