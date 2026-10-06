import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const engineDirectory = path.join(projectRoot, "node_modules", "stockfish", "bin");
const publicDirectory = path.join(projectRoot, "public", "stockfish");
const engineFiles = ["stockfish-19-lite-single.js", "stockfish-19-lite-single.wasm"];

await mkdir(publicDirectory, { recursive: true });
await Promise.all(engineFiles.map((file) =>
  copyFile(path.join(engineDirectory, file), path.join(publicDirectory, file)),
));
await copyFile(
  path.join(projectRoot, "node_modules", "stockfish", "Copying.txt"),
  path.join(publicDirectory, "Copying.txt"),
);
