# Office Showdown

Plataforma híbrida de **torneios + game show** para eventos de escritório, em tempo real.
Um ecrã central (Projetor/TV) mostra a árvore do torneio, os jogos ao vivo e (futuramente) as apostas.
Os utilizadores usam o telemóvel como comando (jogadores), para apostar (plateia) ou para controlar o evento (admins).

## Stack
- **Nuxt 4** (estrutura com pasta `/app`), Vue 3, TypeScript
- **Vuetify 4** (tema escuro, cores néon: primary ciano `#00E5FF`, secondary vermelho `#FF1744`, accent amarelo)
- **@nuxtjs/supabase** — Auth, Postgres, Storage, Realtime
- **@vueuse/motion** (animações `v-motion-*`), **canvas-confetti**, **qrcode**

## Setup (importante ao mudar de PC)
1. `npm install`
2. Criar `.env` na raiz (NÃO está no Git):
   ```
   SUPABASE_URL=https://<projeto>.supabase.co
   SUPABASE_KEY=<anon-public-key>
   ```
3. `npm run dev`
4. A base de dados Supabase é **na cloud e partilhada** — já está toda aplicada. O SQL completo está em `supabase/schema.sql` (apenas para reconstruir do zero).

## Convenções
- **Nomes em português** em todo o domínio (variáveis, tabelas, composables): `torneio`, `partida`, `jogador`, `confirmados`, `perfilDe`, etc.
- Lógica de jogo crítica vive em **funções Postgres (RPC) `security definer`** para evitar batota/race conditions — o cliente nunca decide vencedores.
- Realtime em todas as tabelas; composables recarregam ao focar a aba (rede de segurança, abas em background perdem eventos).
- Componentes auto-importados pelo Nuxt; tipos do Supabase em `app/types/database.types.ts`.

## ⚠️ Regra de ouro: BOTS = JOGADORES REAIS
**Bots e jogadores reais têm exatamente o mesmo comportamento em todo o fluxo.** São intercambiáveis do ponto de vista do motor e da UI:
- Picker Jogar/Plateia no lobby — mesmo UI, mesmas regras de bloqueio (`status_inscricao !== 'QUER_JOGAR'` ou torneio fora de LOBBY).
- **Nunca há botão para entrar numa partida.** Os bots são levados ao palco pelo admin (FAB → `/partida/[id]?como=botId`); os jogadores reais são **auto-navegados** para a página da partida quando o admin a apresenta (`partida_destaque_id`). Não criar botões "Jogar agora" — é o sistema que leva o jogador ao palco no momento certo.
- Até a partida ser apresentada, ambos vêem apenas "aguarda a tua vez no palco" — nada para clicar.
- Qualquer feature nova (jogos, apostas, etc.) tem de ser validada nos dois caminhos: bot personificado via `?como=botId` e jogador real autenticado. Se a regra divergir entre os dois, está errado.

## Arquitetura / ficheiros-chave
```
app/
  composables/
    useAuth.ts        # login/signup (username→email RPC), perfil, avatar, isAdmin
    useTorneios.ts    # lista de torneios na home, inscrever, apagar
    useLobby.ts       # NÚCLEO: torneio, participantes, partidas, bracket,
                      #   sorteio, bots, iniciar/avançar ronda, destaque
    usePartida.ts     # estado de uma partida PPT, jogar, revelação 5s, destaque
    useAgora.ts       # relógio reativo (para a revelação sincronizada)
  pages/
    login.vue, signup.vue, perfil.vue
    index.vue                       # home: lista torneios, criar (admin)
    torneio/[id]/index.vue          # lobby + bracket + campeão (a vista principal)
    torneio/[id]/partida/[partidaId].vue   # jogo PPT (?como=botId p/ personificar)
    torneio/[id]/projetor.vue       # ecrã TV (layout 'projetor', QR no lobby)
  components/
    LogoShowdown.vue, QrCode.vue, TorneioBracket.vue
  layouts/ default.vue (navbar), auth.vue, projetor.vue (fullscreen)
  plugins/ vuetify.ts, auth.client.ts (carrega perfil antes de render)
  middleware/ auth.ts
supabase/schema.sql   # schema completo (backup/reconstrução)
```

## Estados do torneio (fluxo)
`LOBBY` → (admin "Iniciar") → `ARVORE` (revelação dos confrontos) → (admin "Começar jogos")
→ `JOGO` → (admin "Avançar ronda") → ... → `FINAL` (campeão).

- **Destaque:** o admin escolhe 1 partida de cada vez para o projetor (`torneios.partida_destaque_id`).
  Os controlos de jogo SÓ aparecem quando a partida está em destaque. Não se pode trocar de
  partida enquanto a do palco ainda decorre.
- **Bots:** perfis com `is_bot=true` (sem conta auth). O admin personifica-os abrindo
  `?como=<botId>` em nova janela (FAB 🤖 no canto inferior direito).
- **Preferência vs decisão:** jogadores/bots têm `preferencia` ('JOGAR'/'PLATEIA') — é só uma dica.
  Quem decide o elenco é o admin ou o "Sortear elenco" (respeita preferências; máx potência de 2).
- **Jogo por ronda:** configurável em `torneios.jogos_ronda` (ex.: `{"1":"PPT",...}`).
  Catálogo em `app/types/torneio.ts` (`JOGOS_CATALOGO`). Só `PPT` está `disponivel: true`.

## Modelo de dados (resumo — detalhe em supabase/schema.sql)
- `profiles` (id, username, name, admin, is_bot, avatar_url) — sem FK a auth.users (p/ bots)
- `torneios` (status, ronda_atual, max_jogadores, partida_destaque_id, jogos_ronda, vencedor_id)
- `torneio_participantes` (status_inscricao, preferencia, moedas)
- `partidas` (ronda, posicao, jogador1_id, jogador2_id, vencedor_id, estado jsonb, status, revelar_ate)
- RPCs: `get_email_by_username`, `adicionar_bot`, `jogar_ppt`, `apagar_torneio`

---

## ✅ FEITO
Auth (username/password) · perfis + avatares (Storage) · home com torneios · lobby completo
(casting, bots, preferências, sorteio, máximo 2/4/8/16) · motor de torneio (árvore automática,
revelação dos confrontos, avançar rondas, campeão) · **Pedra-Papel-Tesoura** à melhor de 3
(resolução atómica no servidor, revelação de 5s sincronizada) · personificação de bots ·
ecrã do projetor (QR de entrada, palco ao vivo, confetti) · realtime em tudo.

## 🔲 POR FAZER (roadmap, por prioridade)

### 1. Jogos em falta (maior bloco)
Só o PPT está jogável. Implementar cada um: tabela `partidas.estado` (jsonb), função RPC
`security definer` para as jogadas, página de jogo, vista no projetor. Depois marcar
`disponivel: true` em `JOGOS_CATALOGO` (`app/types/torneio.ts`).
- **Jogo do Galo** (Ronda 2) — tabuleiro 3×3
- **Quatro em Linha** (Ronda 3) — grelha 7×6 (ou alternativa "Jogo do Chouriço")
- **Batalha Naval** (Ronda 4) — grelha 5×5
- **Requisito visual (importante):** nos jogos de tabuleiro, as peças são o **avatar redondo
  (`v-avatar`) do jogador** com moldura néon **Azul (Jogador 1)** ou **Vermelho (Jogador 2)**,
  em vez de "X"/"O". Reutilizar o padrão de molduras `.ring-blue`/`.ring-red` já usado.
- Seguir o modelo do PPT: ver `usePartida.ts` + `jogar_ppt` em `supabase/schema.sql` como
  referência (escolhas → resolução → `revelar_ate` de 5s → `status='TERMINADO'` + vencedor).

### 2. Sistema de apostas (por construir do zero)
A coluna `torneio_participantes.moedas` existe mas nada a usa.
- Plateia aposta moedas num dos 2 jogadores de uma partida (provavelmente nova tabela `apostas`).
- Distribuir ganhos/perdas conforme o resultado (RPC atómica).
- **Gráficos de apostas no projetor** (estava na spec original).

### 3. URL pública para o QR (rápido, mas bloqueia uso real)
O QR usa `useRequestURL().origin` → em `localhost` só funciona no próprio PC. Para o evento real,
servir numa rede acessível (IP local tipo `http://192.168.x.x:3000`) ou fazer deploy, e/ou
permitir configurar a base URL pública.

### Polish (opcional)
Som/música de game show · animações extra nas transições de ronda · histórico de torneios passados.

## Notas de teste
Como admin: criar torneio → escolher máximo → "Adicionar bot" (várias vezes) → "Sortear elenco"
ou confirmar à mão → "Iniciar" → ver confrontos → "Começar jogos" → "Apresentar" um confronto
→ abrir o FAB 🤖 e controlar os bots em janelas separadas → "Avançar ronda" até ao campeão.
Abrir o **Projetor** (botão no topo do torneio) numa 2ª janela/TV para ver o show.
