import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths work both at the domain root and on a GitHub Pages project path.
  base: "./",
  // Serve the existing synthetic CSV directly without maintaining a second copy.
  publicDir: "data",
});
