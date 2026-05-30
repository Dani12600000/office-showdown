<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { perfil, uploadAvatar, atualizarPerfil } = useAuth()

// ---- Avatar ----
const inputFicheiro = ref<HTMLInputElement | null>(null)
const uploadEmCurso = ref(false)
const erroUpload = ref('')
const imagemFalhou = ref(false)

// Inicial a mostrar quando não há imagem
const inicial = computed(() => {
  const nome = perfil.value?.name?.trim() || perfil.value?.username?.trim() || ''
  return nome.charAt(0).toUpperCase() || '?'
})
// Mostra a imagem se: existe URL E não falhou a carregar
const temAvatar = computed(() => !!perfil.value?.avatar_url && !imagemFalhou.value)

// Reset do erro quando o url muda (novo upload)
watch(() => perfil.value?.avatar_url, () => { imagemFalhou.value = false })

function abrirSeletor() {
  inputFicheiro.value?.click()
}

async function aoSelecionarFicheiro(evento: Event) {
  const ficheiro = (evento.target as HTMLInputElement).files?.[0]
  if (!ficheiro) return

  uploadEmCurso.value = true
  erroUpload.value = ''
  try {
    await uploadAvatar(ficheiro)
  } catch (e: any) {
    erroUpload.value = e.message
  } finally {
    uploadEmCurso.value = false
    // Limpa o input para permitir selecionar o mesmo ficheiro outra vez
    if (inputFicheiro.value) inputFicheiro.value.value = ''
  }
}

// ---- Editar nome ----
const nomeEditado = ref(perfil.value?.name ?? '')
const aGuardarNome = ref(false)
const sucessoNome = ref(false)

watch(() => perfil.value?.name, (n) => { if (n) nomeEditado.value = n })

async function guardarNome() {
  if (!nomeEditado.value.trim()) return
  aGuardarNome.value = true
  try {
    await atualizarPerfil({ name: nomeEditado.value.trim() })
    sucessoNome.value = true
    setTimeout(() => { sucessoNome.value = false }, 2500)
  } finally {
    aGuardarNome.value = false
  }
}
</script>

<template>
  <v-container class="py-8" max-width="600">
    <div v-motion-fade>

      <!-- Cabeçalho -->
      <h2 class="text-h5 font-weight-bold mb-6">O meu perfil</h2>

      <!-- Card principal -->
      <v-card rounded="xl" elevation="4">
        <v-card-text class="pa-6">

          <!-- ---- Secção do avatar ---- -->
          <div class="d-flex flex-column align-center mb-8">
            <div class="avatar-wrapper" @click="abrirSeletor">
              <!-- Avatar grande -->
              <v-avatar size="120" color="primary" class="avatar-principal">
                <v-img
                  v-if="temAvatar"
                  :src="perfil!.avatar_url!"
                  cover
                  @error="imagemFalhou = true"
                />
                <span v-else class="avatar-inicial">{{ inicial }}</span>
              </v-avatar>

              <!-- Overlay de editar -->
              <div class="avatar-overlay">
                <v-progress-circular v-if="uploadEmCurso" indeterminate color="white" size="28" />
                <v-icon v-else color="white" size="28">mdi-camera</v-icon>
              </div>
            </div>

            <p class="text-caption text-medium-emphasis mt-3">
              Clica na imagem para alterar · JPG, PNG ou WEBP · Máx. 2 MB
            </p>

            <v-alert
              v-if="erroUpload"
              type="error"
              variant="tonal"
              density="compact"
              class="mt-3 w-100"
              closable
              @click:close="erroUpload = ''"
            >
              {{ erroUpload }}
            </v-alert>

            <!-- Input de ficheiro escondido -->
            <input
              ref="inputFicheiro"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="d-none"
              @change="aoSelecionarFicheiro"
            />
          </div>

          <v-divider class="mb-6" />

          <!-- ---- Secção de dados ---- -->
          <v-row dense>
            <!-- Nome (editável) -->
            <v-col cols="12">
              <v-text-field
                v-model="nomeEditado"
                label="Nome de exibição"
                prepend-inner-icon="mdi-account-outline"
                variant="outlined"
                :loading="aGuardarNome"
                :disabled="aGuardarNome"
                hint="O nome que aparece no torneio e na navbar"
                persistent-hint
                @keyup.enter="guardarNome"
              >
                <template #append-inner>
                  <v-fade-transition>
                    <v-icon v-if="sucessoNome" color="success">mdi-check-circle</v-icon>
                  </v-fade-transition>
                </template>
              </v-text-field>
            </v-col>

            <!-- Username (só leitura) -->
            <v-col cols="12" class="mt-1">
              <v-text-field
                :model-value="perfil?.username"
                label="Username"
                prepend-inner-icon="mdi-at"
                variant="outlined"
                readonly
                hint="O username não pode ser alterado"
                persistent-hint
              />
            </v-col>
          </v-row>

          <!-- Botão guardar nome -->
          <v-btn
            color="primary"
            class="mt-5"
            :loading="aGuardarNome"
            :disabled="nomeEditado.trim() === perfil?.name || !nomeEditado.trim()"
            prepend-icon="mdi-content-save-outline"
            @click="guardarNome"
          >
            Guardar alterações
          </v-btn>

        </v-card-text>
      </v-card>
    </div>
  </v-container>
</template>

<style scoped>
.avatar-wrapper {
  position: relative;
  cursor: pointer;
  border-radius: 50%;
  display: inline-block;
}

.avatar-wrapper:hover .avatar-overlay {
  opacity: 1;
}

.avatar-principal {
  display: block;
  transition: filter 0.2s;
}

/* Inicial bem grande, escura sobre o fundo ciano do v-avatar.
   Usa flex full-size para garantir centragem perfeita (a v-avatar
   por si só centra o nó, mas o glyph fica visualmente desviado para cima). */
.avatar-inicial {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 3.5rem;
  font-weight: 900;
  line-height: 1;
  color: #0D0D1A;
  letter-spacing: -0.02em;
  user-select: none;
  /* compensação ótica: descer ligeiramente para o glyph parecer centrado */
  padding-top: 0.08em;
}

.avatar-wrapper:hover .avatar-principal {
  filter: brightness(0.6);
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}
</style>
