/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {
      // Prevent url() rewriting from resolving to dist and causing ENOENT
      transformAssetUrls: false,
    },
  },
}

export default config
