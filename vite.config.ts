import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// LAN party friendly: bind to 0.0.0.0 so other machines on the network can load the page
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
