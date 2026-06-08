import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  preview: {
    host: "0.0.0.0",
    port: 80,
    allowedHosts: [
      "web-cuwc67h0tfqi.up-de-fra1-k8s-1.apps.run-on-seenode.com"
    ]
  }
});
