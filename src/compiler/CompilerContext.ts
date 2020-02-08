import { EnvMapCompiled, EnvFile } from "../Types";
//@ts-ignore
import * as format from "nanoid/format";
import { MersenneTwister } from "../util/MersenneTwister";
import { machineId } from "node-machine-id";

const DEFAULT_ALPHABET =
	"0123456789abcdefghijklmnopqrstuvwxyzABCDEFHIJKLMNOPQRSTUVXYZ_";

type CompilerContextData = {
	seed: string;
};
export class CompilerContext {
	/// Data
	private data: CompilerContextData = { seed: null };
	/**
	 *
	 * @param file
	 */
	async setup(seed?: string) {
		this.data.seed = seed || (await machineId());
	}

	getSeed(): string {
		return this.data.seed;
	}
	/**
	 *
	 * @param env
	 */
	async create(env: EnvMapCompiled, envName: string) {
		let prng: MersenneTwister = null;
		return {
			env: { ...env },
			util: {
				random: (n: number, alphabet?: string) => {
					if (!prng) {
						const seed = `${envName}|${this.data.seed}`;
						prng = new MersenneTwister(seed);
					}
					return this.getRandom(prng, n, alphabet);
				}
			}
		};
	}

	/**
	 * Get a new random string using a PRGN
	 * @param prng
	 * @param n
	 * @param alphabet
	 */
	private getRandom(
		prng: MersenneTwister,
		n: number,
		alphabet?: string
	): string {
		if (alphabet == null) {
			alphabet = DEFAULT_ALPHABET;
		}
		const random = (size: number) => {
			const bytes: number[] = [];
			while (size >= 0) {
				const n = prng.next();
				bytes.push(n & 0xff);
				bytes.push((n >>> 8) & 0xff);
				bytes.push((n >>> 16) & 0xff);
				bytes.push((n >>> 24) & 0xff);
				size -= 4;
			}
			return bytes;
		};
		return format(random, alphabet, n);
	}
}
