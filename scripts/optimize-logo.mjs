import sharp from "sharp";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(
  new URL("../src/assets/solen-digital-transparent.png", import.meta.url),
);
const output = fileURLToPath(
  new URL("../src/assets/solen-digital-transparent.webp", import.meta.url),
);
await sharp(source)
  .webp({ lossless: true, effort: 6, exact: true })
  .toFile(output);
const before = await sharp(source).ensureAlpha().raw().toBuffer();
const after = await sharp(output).ensureAlpha().raw().toBuffer();
if (!before.equals(after))
  throw new Error("Logo encoding changed pixels or transparency.");
console.log(
  "Lossless WebP written; decoded pixels and alpha match the PNG exactly.",
);
