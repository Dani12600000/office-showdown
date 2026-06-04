import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  future: {
    compatibilityVersion: 4,
  },

  modules: [
    '@nuxtjs/supabase',
    '@vueuse/nuxt',
    '@vueuse/motion/nuxt',
    // Integração vite-plugin-vuetify via hook — auto-importa componentes por tree-shaking
    (_options, nuxt) => {
      nuxt.hooks.hook('vite:extendConfig', (config) => {
        config.plugins?.push(vuetify({ autoImport: true }))
      })
    },
  ],

  css: [
    'vuetify/styles',
    '@mdi/font/css/materialdesignicons.css',
  ],

  build: {
    transpile: ['vuetify'],
  },

  vite: {
    vue: {
      template: {
        transformAssetUrls,
      },
    },
    define: {
      'process.env.DEBUG': false,
    },
    optimizeDeps: {
      include: ['vuetify'],
    },
  },

  supabase: {
    redirect: false,
    types: '~/types/database.types.ts',
    clientOptions: {
      auth: {
        flowType: 'pkce',
      },
    },
  },
})
