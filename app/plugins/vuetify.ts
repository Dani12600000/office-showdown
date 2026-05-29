import { createVuetify } from 'vuetify'
import * as directives from 'vuetify/directives'

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    ssr: true,
    directives,
    theme: {
      defaultTheme: 'dark',
      themes: {
        dark: {
          dark: true,
          colors: {
            // Cores néon do Office Showdown
            primary: '#00E5FF',    // Ciano néon (Jogador 1 / Azul)
            secondary: '#FF1744',  // Vermelho néon (Jogador 2)
            accent: '#FFD600',     // Amarelo — moedas / apostas
            background: '#0D0D1A',
            surface: '#1A1A2E',
            'surface-variant': '#16213E',
            success: '#00E676',
            warning: '#FFAB00',
            error: '#FF1744',
          },
        },
      },
    },
    defaults: {
      VBtn: { rounded: 'lg', variant: 'elevated' },
      VCard: { rounded: 'xl' },
      VAvatar: { rounded: 'circle' },
    },
  })

  nuxtApp.vueApp.use(vuetify)
})
