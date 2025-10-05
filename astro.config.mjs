// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://raidcalculator.net",
  integrations: [mdx(), sitemap(), react()],
  
  vite: {
    plugins: [tailwindcss()],
  },
});