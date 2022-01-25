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
					const bytes = this.getRandomBytes(getPrgn(), 16);
					bytes[6] = (bytes[6] & 0x0f) | 0x40;
					bytes[8] = (bytes[8] & 0x3f) | 0x80;
					const parts = [
						bytes.slice(0, 4),
						bytes.slice(4, 6),
						bytes.slice(6, 8),
						bytes.slice(8, 10),
						bytes.slice(10, 16),
					];
					return parts.map((b) => b.toString("hex")).join("-");
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
		const random = (size: number) => this.getRandomBytes(prng, size);
		return format(random, alphabet, n);
	}
}
