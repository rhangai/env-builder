import { readFile as fsReadFile, writeFile as fsWriteFile } from "fs";

export function readFile(filename: string): Promise<string> {
	return new Promise((resolve, reject) => {
		fsReadFile(filename, "utf8", (err, data) => {
			err ? reject(err) : resolve(data);
		});
	});
}

export function writeFile(filename: string, data: string): Promise<void> {
	return new Promise((resolve, reject) => {
		fsWriteFile(filename, data, "utf8", err => {
			err ? reject(err) : resolve();
		});
	});
}
