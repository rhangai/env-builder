import { EnvMapCompiled } from "../Types";
import { customRandom } from "nanoid";
import { MersenneTwister } from "../util/MersenneTwister";
import { machineId } from "node-machine-id";
import { v4 as uuidv4 } from "uuid";

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
	 * Create a new context.
	 * @param env
	 */
	async create(env: EnvMapCompiled, envName: string) {
		let prng: MersenneTwister = null;
		const getPrgn = () => {
			if (!prng) {
				const seed = `${envName}|${this.data.seed}`;
				prng = new MersenneTwister(seed);
			}
			return prng;
		};
		return {
			env: { ...env },
			util: {
				random: (n: number, alphabet?: string) => {
					return this.getRandom(getPrgn(), n, alphabet);
				},
				uuidv4: () => {
					return uuidv4({
						random: this.getRandomBytes(getPrgn(), 16),
					});
				},
			},
		};
	}
	/**
	 * Generate a new random bytes
	 */
	private getRandomBytes(prng: MersenneTwister, size: number): Buffer {
		const buffer = Buffer.allocUnsafe(size);
		let index = 0;
		let rest = size;
		while (rest >= 4) {
			const n = prng.next();
			buffer.writeUInt32LE(n, index);
			rest -= 4;
			index += 4;
		}
		if (rest > 0) {
			let n = prng.next();
			while (rest > 0) {
				buffer[index] = n & 0xff;
				++index;
				--rest;
				n = n >> 8;
			}
		}
		return buffer;
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
		const random = customRandom(alphabet, n, (size: number) =>
			this.getRandomBytes(prng, size)
		);
		return random();
	}
}
