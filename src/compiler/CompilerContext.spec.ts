import { CompilerContext } from "./CompilerContext";

type SeedConfig = {
	seed: string;
	random?: Record<string, [number, string]>;
	uuidv4?: Record<string, string>;
};

const SEEDS: SeedConfig[] = [
	{
		seed: "Blby@BuVk{j1>KA$a-;2IUPbGjKJN++P",
		random: {
			test1: [16, "f2kqmzV9uVFwZAE8"],
			test2: [32, "5V1NQCt3kcFVH2eaFfHTtwOuNsbO0AtY"],
			test3: [48, "_kSZPfAi5hP3q2HlDKtoj3P13JK6ec37YjzEVXo24aP60Y6N"],
		},
		uuidv4: {
			test1: "a79f4973-8eb3-4502-b1af-2948e8e47b60",
			test2: "67944eb7-1249-4ec0-88ba-81a02ae7ce11",
			test3: "607c22b1-6775-4305-8130-3d5916db6bfc",
		},
	},
	{
		seed: "Kw4N$A^~nw&&5~xMfme0>6V0iCxQDB9",
		random: {
			test1: [16, "VCBNpZ7drCLAMMbK"],
			test2: [32, "J3IRBYSkZnNwkbg6r4JSSAq99y7FQld4"],
			test3: [48, "4VUc1zNalxFQoUlpBaoiDIeaEAzlsnYsS5wE8pAQhfIC94gC"],
		},
		uuidv4: {
			test1: "6477668e-ed10-4bb7-b37a-08ed8bafef64",
			test2: "955932ae-f5ab-4c9c-af90-703cde8e4cf2",
			test3: "ec842532-1966-4e14-9acb-aaebb7151993",
		},
	},
];

describe("CompilerContext", () => {
	describe("#context.random", () => {
		it("should generate the same values", async () => {
			//
			for (const { seed, random } of SEEDS) {
				if (!random) continue;
				const compilerContext = new CompilerContext();
				await compilerContext.setup(seed);

				for (const [key, [size, expected]] of Object.entries(random)) {
					const context = await compilerContext.create({}, key);
					const value = context.util.random(size);
					expect(value).toBe(expected);
				}
			}
		});
	});

	describe("#context.uuidv4", () => {
		it("should generate the same values", async () => {
			//
			for (const { seed, uuidv4 } of SEEDS) {
				if (!uuidv4) continue;
				const compilerContext = new CompilerContext();
				await compilerContext.setup(seed);

				for (const [key, expected] of Object.entries(uuidv4)) {
					const context = await compilerContext.create({}, key);
					const value = context.util.uuidv4();
					expect(value).toBe(expected);
				}
			}
		});
	});
});
