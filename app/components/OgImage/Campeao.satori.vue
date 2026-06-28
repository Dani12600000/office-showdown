<script setup lang="ts">
// Cartão de partilha (Open Graph) — renderizado por Satori (nuxt-og-image).
// Mostra OS DOIS campeões: o vencedor dos jogos e o maior apostador (se existir).
// Satori só suporta flexbox + um subconjunto de CSS, por isso TUDO é flex e estilos inline.
withDefaults(defineProps<{
  nome?: string
  torneio?: string
  avatar?: string | null
  apostador?: string | null
  apostadorAvatar?: string | null
  apostadorGanho?: number | null
}>(), { nome: '', torneio: '', avatar: null, apostador: null, apostadorAvatar: null, apostadorGanho: null })
</script>

<template>
  <div
    style="width:1200px;height:630px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-family:'Inter';background-color:#0D0D1A;background-image:radial-gradient(circle at 18% 0%, rgba(0,229,255,0.22), transparent 45%), radial-gradient(circle at 86% 102%, rgba(255,23,68,0.22), transparent 45%);position:relative;"
  >
    <div style="display:flex;align-items:flex-start;justify-content:center;">
      <!-- Campeão dos jogos -->
      <div style="display:flex;flex-direction:column;align-items:center;width:480px;">
        <div style="display:flex;font-size:26px;letter-spacing:8px;color:#00E5FF;font-weight:800;margin-bottom:22px;">
          CAMPEÃO
        </div>
        <div
          style="display:flex;width:220px;height:220px;border-radius:220px;align-items:center;justify-content:center;overflow:hidden;background-color:#10243a;border:8px solid #00E5FF;box-shadow:0 0 60px rgba(0,229,255,0.6);margin-bottom:26px;"
        >
          <img
            v-if="avatar"
            :src="avatar"
            width="220"
            height="220"
            style="width:220px;height:220px;object-fit:cover;"
          />
          <div v-else style="display:flex;font-size:110px;font-weight:900;color:#00E5FF;">
            {{ (nome || '?').charAt(0).toUpperCase() }}
          </div>
        </div>
        <div style="display:flex;font-size:54px;font-weight:900;line-height:1;text-align:center;max-width:460px;">
          {{ nome || '—' }}
        </div>
      </div>

      <!-- Maior apostador -->
      <div v-if="apostador" style="display:flex;flex-direction:column;align-items:center;width:480px;">
        <div style="display:flex;font-size:26px;letter-spacing:8px;color:#FF1744;font-weight:800;margin-bottom:22px;">
          MAIOR APOSTADOR
        </div>
        <div
          style="display:flex;width:220px;height:220px;border-radius:220px;align-items:center;justify-content:center;overflow:hidden;background-color:#3a1018;border:8px solid #FF1744;box-shadow:0 0 60px rgba(255,23,68,0.6);margin-bottom:26px;"
        >
          <img
            v-if="apostadorAvatar"
            :src="apostadorAvatar"
            width="220"
            height="220"
            style="width:220px;height:220px;object-fit:cover;"
          />
          <div v-else style="display:flex;font-size:110px;font-weight:900;color:#FF1744;">
            {{ (apostador || '?').charAt(0).toUpperCase() }}
          </div>
        </div>
        <div style="display:flex;font-size:54px;font-weight:900;line-height:1;text-align:center;max-width:460px;">
          {{ apostador }}
        </div>
        <div v-if="apostadorGanho" style="display:flex;font-size:32px;font-weight:800;color:#FFD600;margin-top:14px;">
          +{{ apostadorGanho }} 🪙
        </div>
      </div>
    </div>

    <div v-if="torneio" style="display:flex;font-size:32px;color:rgba(255,255,255,0.72);margin-top:40px;">
      {{ torneio }}
    </div>

    <div style="display:flex;position:absolute;bottom:34px;font-size:24px;letter-spacing:5px;font-weight:800;color:rgba(255,255,255,0.5);">
      OFFICE SHOWDOWN
    </div>
  </div>
</template>
