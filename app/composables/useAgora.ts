// Relógio reativo — devolve o timestamp atual (ms), atualizado periodicamente.
// Útil para comparar com prazos guardados na BD (ex.: revelar_ate).
export const useAgora = (intervaloMs = 250) => {
  const agora = ref(Date.now())
  let id: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    id = setInterval(() => { agora.value = Date.now() }, intervaloMs)
  })
  onUnmounted(() => { if (id) clearInterval(id) })

  return agora
}
