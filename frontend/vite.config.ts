import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'
// vite-imagetools is ESM-only - using dynamic import
const { imagetools } = await import('vite-imagetools')

/**
 * Vite Configuration
 *
 * Optimizations:
 * - Code splitting for better caching
 * - Tree-shaking for unused code removal
 * - Bundle visualization for analysis
 * - Critical CSS extraction for faster First Paint
 * - PWA with offline support and caching strategies
 * - Image optimization with vite-imagetools
 * - Source maps for production debugging (optional)
 */
export default defineConfig({
  plugins: [
    react(),

    // Image optimization - enables srcset and format conversion imports
    imagetools({
      defaultDirectives: (url) => {
        // Default optimizations for images
        if (url.searchParams.has('background')) {
          // Room backgrounds - multiple sizes and WebP
          return new URLSearchParams({
            format: 'webp;jpg',
            w: '400;800;1200;1600',
            quality: '80',
            as: 'picture',
          });
        }
        return new URLSearchParams();
      },
    }),

    // PWA Plugin with Workbox (injectManifest mode for custom service worker)
    VitePWA({
      // Use injectManifest to allow custom service worker with push notifications
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png', 'icons/*.svg', 'screenshots/*.png', 'manifest.webmanifest'],

      // Manifest configuration
      manifest: {
        name: 'אלי מאור – סידור וארגון הבית',
        short_name: 'אלי מאור',
        description: 'אפליקציה לניהול ארגון הבית עם משימות, חדרים וקטגוריות',
        lang: 'he',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#FAF3E0',
        theme_color: '#FAF3E0',
        categories: ['productivity', 'lifestyle', 'utilities'],
        icons: [
          {
            src: '/icons/icon-72x72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-96x96.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-128x128.png',
            sizes: '128x128',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-144x144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-152x152.png',
            sizes: '152x152',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-384x384.png',
            sizes: '384x384',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any'
          }
        ],
        shortcuts: [
          {
            name: 'הוסף משימה',
            short_name: 'משימה חדשה',
            description: 'צור משימה חדשה',
            url: '/tasks/new',
            icons: [{ src: '/icons/shortcut-add-task.png', sizes: '96x96' }]
          },
          {
            name: 'החדרים שלי',
            short_name: 'חדרים',
            description: 'צפה בכל החדרים',
            url: '/rooms',
            icons: [{ src: '/icons/shortcut-rooms.png', sizes: '96x96' }]
          }
        ]
      },

      // injectManifest options
      injectManifest: {
        // Glob patterns for precaching
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Ignore source maps and node_modules
        globIgnores: ['**/node_modules/**/*', '**/*.map'],
        // Increase max file size for precaching (some chunks may be larger)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
      },

      // Dev options
      devOptions: {
        enabled: false, // Disable PWA in development
        type: 'module'
      }
    }),

    // Bundle visualizer - generates stats.html when ANALYZE=true
    ...(process.env.ANALYZE === 'true' ? [
      visualizer({
        filename: 'stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap', // or 'sunburst', 'network'
      })
    ] : []),
  ],

  // CSS optimization
  css: {
    // Extract CSS into separate files
    devSourcemap: true,
    modules: {
      localsConvention: 'camelCase',
    },
    // PostCSS is configured in postcss.config.cjs
  },

  server: {
    host: '0.0.0.0',
    port: 5179,
    strictPort: false,
    fs: {
      strict: false
    },
    // Vite automatically serves .webmanifest files with correct MIME type
    // The mime-types package (used by Vite) recognizes .webmanifest as application/manifest+json
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,  // Changes the origin of the host header to the target URL
        secure: false,  // Allow self-signed certificates if using HTTPS
        // CRITICAL: Do NOT use rewrite - backend expects /api prefix
        // Without rewrite: /api/auth/register → http://localhost:8000/api/auth/register ✅
        // With rewrite: /api/auth/register → http://localhost:8000/auth/register ❌ (404)
        // 
        // Backend routers are defined with prefix="/api" (see backend/app/main.py)
        // Example: app.include_router(auth.router, prefix="/api", tags=["auth"])
        // So backend expects: http://localhost:8000/api/auth/register
        // 
        // rewrite: (path) => path.replace(/^\/api/, ''),  // ❌ DON'T USE - backend needs /api
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
        secure: false,
      }
    }
  },

  build: {
    outDir: 'dist',
    // Enable sourcemaps for bundle analysis
    sourcemap: true,
    assetsDir: 'assets',
    // Minification - esbuild is faster than terser (2-10x faster)
    minify: 'esbuild',
    // esbuild minify options (simpler than terser, but faster)
    // Note: esbuild automatically removes console.log in production builds
    // For more control, use terser instead
    // Chunk size warnings
    chunkSizeWarningLimit: 500, // KB

    rollupOptions: {
      output: {
        // Asset file naming
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/img/[name]-[hash][extname]`;
          }
          if (/woff2?|eot|ttf|otf/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          if (/css/i.test(ext)) {
            return `assets/css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',

        // Manual chunk splitting for better caching
        manualChunks: (id) => {
          // React core - changes rarely
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')) {
            return 'react-vendor';
          }

          // React Router - changes rarely
          if (id.includes('node_modules/react-router') ||
              id.includes('node_modules/@remix-run/')) {
            return 'router-vendor';
          }

          // React Query - data fetching
          if (id.includes('node_modules/@tanstack/')) {
            return 'query-vendor';
          }

          // i18n - internationalization
          if (id.includes('node_modules/i18next') ||
              id.includes('node_modules/react-i18next')) {
            return 'i18n-vendor';
          }

          // FullCalendar - heavy, lazy load if possible
          if (id.includes('node_modules/@fullcalendar/')) {
            return 'calendar-vendor';
          }

          // DnD Kit - drag and drop
          if (id.includes('node_modules/@dnd-kit/')) {
            return 'dnd-vendor';
          }

          // Axios and other HTTP
          if (id.includes('node_modules/axios')) {
            return 'http-vendor';
          }

          // Other vendor code
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
        },
      },
    },
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'i18next',
      'react-i18next',
      'i18next-browser-languagedetector',
      '@tanstack/react-query',
      'lucide-react',
      'react-hot-toast',
    ],
    exclude: [],
    // Force pre-bundling to avoid warnings
    force: false,
    // Ensure api.ts is properly resolved
    esbuildOptions: {
      resolveExtensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']
    }
  },
  
  // Ensure TypeScript files are processed correctly
  esbuild: {
    include: /\.tsx?$/,
    exclude: []
  },

  resolve: {
    alias: {
      '@': '/src'
    },
    // Ensure TypeScript files are resolved correctly
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']
  },

  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
  },

  clearScreen: false,

  // Preview server config
  preview: {
    port: 5179,
    host: '0.0.0.0',
  },
})
