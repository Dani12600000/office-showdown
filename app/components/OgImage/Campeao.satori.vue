<script setup lang="ts">
// Cartão de partilha (Open Graph) do campeão — renderizado por Satori (nuxt-og-image).
// Satori só suporta flexbox + um subconjunto de CSS, por isso TUDO é flex e estilos inline.
withDefaults(defineProps<{
  nome?: string
  torneio?: string
  avatar?: string | null
}>(), { nome: '', torneio: '', avatar: null })
</script>

<template>
  <div
    style="width:1200px;height:630px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-family:'Inter';background-color:#0D0D1A;background-image:radial-gradient(circle at 18% 0%, rgba(0,229,255,0.22), transparent 45%), radial-gradient(circle at 86% 102%, rgba(255,23,68,0.22), transparent 45%);position:relative;"
  >
    <div style="display:flex;font-size:30px;letter-spacing:10px;color:#00E5FF;font-weight:800;margin-bottom:26px;">
      CAMPEÃO
    </div>

    <div
      style="display:flex;width:240px;height:240px;border-radius:240px;align-items:center;justify-content:center;overflow:hidden;background-color:#10243a;border:8px solid #00E5FF;box-shadow:0 0 70px rgba(0,229,255,0.6);margin-bottom:30px;"
    >
      <img
        v-if="avatar"
        :src="avatar"
        width="240"
        height="240"
        style="width:240px;height:240px;object-fit:cover;"
      />
      <div v-else style="display:flex;font-size:120px;font-weight:900;color:#00E5FF;">
        {{ (nome || '?').charAt(0).toUpperCase() }}
      </div>
    </div>

    <div style="display:flex;font-size:84px;font-weight:900;line-height:1;text-align:center;max-width:1060px;">
      {{ nome || '—' }}
    </div>

    <div v-if="torneio" style="display:flex;font-size:34px;color:rgba(255,255,255,0.72);margin-top:20px;">
      {{ torneio }}
    </div>

    <div style="display:flex;position:absolute;bottom:38px;font-size:26px;letter-spacing:5px;font-weight:800;color:rgba(255,255,255,0.5);">
      OFFICE SHOWDOWN
    </div>
  </div>
</template>
