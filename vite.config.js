import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: "charts",
              test: /node_modules[\\/]recharts[\\/]/,
              priority: 20,
            },
            { name: "vendor", test: /node_modules[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  // Relative asset paths work both at the domain root and on a GitHub Pages project path.
  base: "./",
  // Serve the existing synthetic CSV directly without maintaining a second copy.
  publicDir: "data",
});
