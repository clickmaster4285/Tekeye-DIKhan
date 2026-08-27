import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import * as path from "path"
import * as fs from "fs"

const projectRoot = path.resolve(__dirname)

// Ensure dist/icon.svg exists so vite:css-analysis doesn't throw ENOENT when resolving /icon.svg
function ensureDistIconPlugin() {
  return {
    name: "ensure-dist-icon",
    configResolved() {
      const distIcon = path.join(projectRoot, "dist", "icon.svg")
      const publicIcon = path.join(projectRoot, "public", "icon.svg")
      if (!fs.existsSync(distIcon) && fs.existsSync(publicIcon)) {
        const distDir = path.dirname(distIcon)
        if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true })
        fs.copyFileSync(publicIcon, distIcon)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "")
  const apiBase = env.VITE_API_BASE_URL?.trim()
  // Same-origin /api + /media + /ml via proxy.
  const proxyTarget = apiBase || "http://127.0.0.1:8000"
  const mlProxyTarget = env.VITE_ML_SERVICE_URL?.trim() || "http://127.0.0.1:8100"
  const useDevProxy =
    !apiBase ||
    apiBase.startsWith("http://127.0.0.1") ||
    apiBase.startsWith("http://localhost")

  return {
    root: projectRoot,
    publicDir: path.join(projectRoot, "public"),
    plugins: [
      ensureDistIconPlugin(),
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: [
          "pakistan-customs-logo.png",
          "icon.svg",
          "models/blazeface/model.json",
          "models/blazeface/group1-shard1of1.bin",
        ],
        manifest: {
          name: "Pakistan Customs — Secure Access Portal",
          short_name: "Customs Portal",
          description:
            "Pakistan Customs integrated management system — VMS, WMS, AI Analytics, and more.",
          theme_color: "#2563eb",
          background_color: "#fafafa",
          display: "standalone",
          orientation: "any",
          scope: "/",
          start_url: "/",
          lang: "en",
          dir: "ltr",
          icons: [
            {
              src: "pakistan-customs-logo.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "pakistan-customs-logo.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,jpg,jpeg,bin,json}"],
          navigateFallback: "/index.html",
          // Never let the SW claim API/media/ML — MJPEG multipart streams break if intercepted.
          navigateFallbackDenylist: [/^\/api/, /^\/media/, /^\/ml/, /^\/_/],
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                url.pathname.startsWith("/ml/") ||
                url.pathname.startsWith("/api/") ||
                url.pathname.startsWith("/media/"),
              handler: "NetworkOnly",
            },
          ],
        },
      }),
    ],
    optimizeDeps: {
      include: ["qrcode"],
    },
    build: {
      commonjsOptions: {
        include: [/qrcode/, /node_modules/],
        transformMixedEsModules: true,
      },
    },
    resolve: {
      alias: {
        "@": path.join(projectRoot, "src"),
      },
    },
    server: {
      port: 3000,
      ...(useDevProxy
        ? {
            proxy: {
              "/api": { target: proxyTarget, changeOrigin: true, secure: false },
              "/media": { target: proxyTarget, changeOrigin: true, secure: false },
              // Browser MJPEG feeds use /ml/... (same-origin). Strip prefix → ML api_server.
              // Long-lived multipart streams need no proxy timeout / no buffering.
              "/ml": {
                target: mlProxyTarget,
                changeOrigin: true,
                secure: false,
                timeout: 0,
                proxyTimeout: 0,
                rewrite: (p: string) => p.replace(/^\/ml/, ""),
                configure: (proxy) => {
                  proxy.on("proxyReq", (proxyReq) => {
                    proxyReq.setHeader("Accept-Encoding", "identity")
                  })
                  proxy.on("proxyRes", (proxyRes) => {
                    proxyRes.headers["cache-control"] = "no-cache, no-store, must-revalidate"
                    proxyRes.headers["pragma"] = "no-cache"
                    proxyRes.headers["x-accel-buffering"] = "no"
                  })
                },
              },
            },
          }
        : {}),
    },
    preview: {
      port: 3000,
    },
  }
})
