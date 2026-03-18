import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");
const sourceStylePath = path.join(packageRoot, "src", "style.css");
const distDirPath = path.join(packageRoot, "dist");
const distStylePath = path.join(distDirPath, "style.css");

await mkdir(distDirPath, { recursive: true });
await cp(sourceStylePath, distStylePath);
