export type EnvEntry =
	| {
			value: string;
	  }
	| {
			expression: string;
	  };

export type EnvMap = {
	[key: string]: EnvEntry;
};

export type EnvMapCompiled = {
	[key: string]: string | false;
};

export type EnvCompilationResult = {
	env: EnvMapCompiled;
	seed: string;
};

export type EnvFile =
	| {
			filename: string;
	  }
	| {
			content: string;
	  };
