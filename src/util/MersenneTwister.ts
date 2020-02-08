const N = 624;
const M = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;
const DEFAULT_SEED = 5489;

export class MersenneTwister {
	private state: number[] = new Array(N);
	private stateIndex = 0;

	/// Construct the prng
	constructor(seed?: number | string) {
		if (seed == undefined) {
			seed = new Date().getTime();
		}
		this.seed(seed);
	}

	/**
	 * Seeds the prn
	 * @param s
	 */
	seed(seed: number | string) {
		if (typeof seed === "number") {
			this.seedNumber(seed);
		} else if (typeof seed === "string") {
			this.seedString(seed);
		} else {
			throw new Error(`Invalid seed`);
		}
	}

	/**
	 * Seeds the prn
	 * @param s
	 */
	private seedNumber(seed: number) {
		let seedState: number = seed;
		this.state[0] = seedState >>> 0;
		for (this.stateIndex = 1; this.stateIndex < N; this.stateIndex++) {
			seedState =
				this.state[this.stateIndex - 1] ^
				(this.state[this.stateIndex - 1] >>> 30);
			this.state[this.stateIndex] =
				((((seedState & 0xffff0000) >>> 16) * 1812433253) << 16) +
				(seedState & 0x0000ffff) * 1812433253 +
				this.stateIndex;
			this.state[this.stateIndex] >>>= 0;
		}
	}

	/**
	 * Seed using a string
	 * @param key
	 */
	private seedString(key: string) {
		this.seedNumber(19650218);

		const keyLength = key.length;
		let i = 1;
		let j = 0;
		let k = N > keyLength ? N : keyLength;
		for (; k; k--) {
			const s = this.state[i - 1] ^ (this.state[i - 1] >>> 30);
			this.state[i] =
				(this.state[i] ^
					(((((s & 0xffff0000) >>> 16) * 1664525) << 16) +
						(s & 0x0000ffff) * 1664525)) +
				key.charCodeAt(j) +
				j;
			this.state[i] >>>= 0;
			i++;
			j++;
			if (i >= N) {
				this.state[0] = this.state[N - 1];
				i = 1;
			}
			if (j >= keyLength) j = 0;
		}
		for (k = N - 1; k; k--) {
			const s = this.state[i - 1] ^ (this.state[i - 1] >>> 30);
			this.state[i] =
				(this.state[i] ^
					(((((s & 0xffff0000) >>> 16) * 1566083941) << 16) +
						(s & 0x0000ffff) * 1566083941)) -
				i; /* non linear */
			this.state[i] >>>= 0;
			i++;
			if (i >= N) {
				this.state[0] = this.state[N - 1];
				i = 1;
			}
		}
		this.state[0] = 0x80000000;
	}
	/**
	 * Generates the next number
	 */
	next() {
		let y: number;
		const mag01 = [0x0, MATRIX_A];
		if (this.stateIndex >= N) {
			let kk;
			for (kk = 0; kk < N - M; kk++) {
				y =
					(this.state[kk] & UPPER_MASK) |
					(this.state[kk + 1] & LOWER_MASK);
				this.state[kk] =
					this.state[kk + M] ^ (y >>> 1) ^ mag01[y & 0x1];
			}
			for (; kk < N - 1; kk++) {
				y =
					(this.state[kk] & UPPER_MASK) |
					(this.state[kk + 1] & LOWER_MASK);
				this.state[kk] =
					this.state[kk + (M - N)] ^ (y >>> 1) ^ mag01[y & 0x1];
			}
			y = (this.state[N - 1] & UPPER_MASK) | (this.state[0] & LOWER_MASK);
			this.state[N - 1] = this.state[M - 1] ^ (y >>> 1) ^ mag01[y & 0x1];

			this.stateIndex = 0;
		}

		y = this.state[this.stateIndex++];

		y ^= y >>> 11;
		y ^= (y << 7) & 0x9d2c5680;
		y ^= (y << 15) & 0xefc60000;
		y ^= y >>> 18;

		return y >>> 0;
	}
}
