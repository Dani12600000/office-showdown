<script setup lang="ts">
import QRCode from 'qrcode'

const props = withDefaults(defineProps<{
  value: string
  size?: number
}>(), { size: 240 })

const dataUrl = ref('')

async function gerar() {
  if (!props.value) return
  dataUrl.value = await QRCode.toDataURL(props.value, {
    width: props.size,
    margin: 1,
    color: { dark: '#0D0D1A', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  })
}

watch(() => [props.value, props.size], gerar, { immediate: true })
</script>

<template>
  <div class="qr-wrapper" :style="{ width: size + 'px', height: size + 'px' }">
    <img v-if="dataUrl" :src="dataUrl" :width="size" :height="size" alt="QR code" />
  </div>
</template>

<style scoped>
.qr-wrapper {
  background: #fff;
  border-radius: 16px;
  padding: 12px;
  box-sizing: content-box;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 40px rgba(0, 229, 255, 0.35);
}
.qr-wrapper img {
  display: block;
  border-radius: 6px;
}
</style>
