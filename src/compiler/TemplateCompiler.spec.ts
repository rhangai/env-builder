import { TemplateCompiler } from "./TemplateCompiler";
import { parse as envParse } from "dotenv";

type TemplateCompilerTest = {
	env: Record<string, string>;
	input: string;
	expected: string;
};

const TEST: TemplateCompilerTest[] = [
	{
		env: { A: "10" },
		input: "A=",
		expected: "A=10",
	},
	{
		env: { VAR: "!@#$" },
		input: "VAR=",
		expected: "VAR='!@#$'",
	},
	{
		env: { VAR: '"oi' },
		input: "VAR=",
		expected: "VAR='\"oi'",
	},
];

describe("TemplateCompiler", () => {
	describe("#compile", () => {
		it("should generate the same values", async () => {
			const templateCompiler = new TemplateCompiler();
			//
			for (const { env, input, expected } of TEST) {
				const result = await templateCompiler.compile(
					{ content: input },
					env
				);
				expect(result).toBe(expected);
				const parsed = envParse(result);
				expect(parsed).toStrictEqual(env);
			}
		});
	});
});
