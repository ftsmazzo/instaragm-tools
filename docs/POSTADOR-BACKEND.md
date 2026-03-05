# Postador no backend próprio – viabilidade e arquitetura

## Resposta direta: **sim, é possível**

Todo o processo do Postador pode ser trazido para o nosso backend (API Fastify), com:

- **Controle total**: configurações, tokens, fluxo e persistência no nosso sistema.
- **MinIO** para armazenar mídia (em vez de Cloudinary).
- **Detecção automática** do tipo de mídia (vídeo → Reels, imagem → feed).
- **Geração de mídia por IA** quando o usuário não envia arquivo — no backend ou, se preferir, via webhook n8n só para essa parte.
- **Um único fluxo** para todos os tipos de post (imagem, Reels, “só texto” → gera imagem).

O n8n pode ficar apenas para outros fluxos (comentários, Direct, raspagem etc.); o Postador passa a ser 100% nosso ou híbrido (IA no n8n, resto no backend).

---

## Reestruturação do Postador (visão atual)

### O que mudou em relação ao desenho antigo

- **Antes:** o formulário misturava “post” com “produto” (nome, descrição, preço) e gravava uma “publicação” no envio. Havia confusão entre capturar dados de produto e dados da postagem.
- **Hoje:** as **postagens** já vêm do Instagram via **raspagem** (API Meta) e ficam na tabela `postagens`. Não faz sentido gravar de novo uma “publicação” a partir do formulário do Postador.
- **Objetivo:** a pessoa só precisa informar **a descrição do que quer postar** — seja sobre um produto, um imóvel, um evento ou qualquer coisa. Sem vínculo obrigatório com cadastro de produto no formulário. A **gravação** das postagens continua sendo feita **somente pela raspagem** (workflow que alimenta `postagens`).

### Entrada do Postador (simplificada)

| Campo | Obrigatório | Descrição |
|-------|------------|-----------|
| **descricao** (texto) | Sim | Texto livre: o que a pessoa quer postar (pode ser sobre produto, imóvel, oferta, etc.). |
| **arquivo** (mídia) | Não | Vídeo ou imagem — tipo detectado automaticamente (vídeo → Reels, imagem → feed). |

**Sem** campos de produto no formulário (nome produto, descrição produto, preço). Quem preenche descreve na própria descrição o que quiser.

### Onde os dados ficam

- **Tabela `postagens`**: alimentada **apenas pela raspagem** (workflow que consome a API do Instagram). Após publicar pelo Postador, o post aparece no Instagram e a raspagem passa a trazê-lo para `postagens`. Não gravamos “publicação” no envio do formulário.
- **Persistência do Postador**: opcional, mas recomendada. Uma tabela (ex.: `log_postador` ou `postador_itens`) permite:
  - **Histórico** do que foi enviado pelo painel (data, caption resumido, id do container Instagram, status).
  - **Agendamento / cronograma**: guardar rascunhos ou itens com `data_agendada` e um job (cron) que, na hora programada, publica no Instagram. Assim o usuário pode montar posts e agendar para datas/horários específicos.
  Não é obrigatório para o fluxo mínimo (publicar na hora), mas facilita auditoria e agendamento futuro.

### Post por URL do imóvel (Imobiliária) — implementado

**Objetivo:** em foco imobiliária, a pessoa pode **colar o link da página de detalhes do imóvel** (ex.: `https://cmr-imobiliaria-site-imoveis.90qhxz.easypanel.host/imoveis/b5ee882c-f801-4488-acfd-bc2ce080af69`) e o sistema:

1. Acessar a URL e extrair: título, código, localização, valores, resumo, características, descrição e URL da imagem (suporta Next.js __NEXT_DATA__ e HTML).
2. Baixar a imagem e fazer upload no Cloudinary (URL pública estável). Gerar legenda com a IA. Endpoint: POST /api/postador/por-url.

Se for complexo incluir de imediato, deixa-se a **possibilidade aberta**: um endpoint alternativo (ex.: `POST /api/postador/por-link`) que recebe `url`, faz fetch da página, parse (scraping ou API do site), gera descrição (+ imagem) e chama o mesmo pipeline de publicação. A tela do Postador pode ganhar um modo “Colar link do imóvel” que envia essa URL.

---

## O que o fluxo atual (n8n) faz (referência)

1. Recebe formulário: **texto** (obrigatório), **arquivo** (vídeo ou imagem, opcional), **produto** (nome, descrição, preço, opcional).
2. Se há arquivo → envia para Cloudinary → obtém URL pública.
3. **Detecção por mimetype**: vídeo → Reels, imagem → post de imagem.
4. **Reels**: Graph API `media` (video_url, caption, media_type REELS) → espera ~60s → `media_publish`.
5. **Imagem**: Graph API `media` (image_url, caption) → `media_publish`.
6. **Sem arquivo**: IA gera legenda + sugestão de imagem → gera imagem (ex.: DALL·E) → sobe no Cloudinary → post de imagem.
7. Persiste em PostgreSQL (publicações, produtos).

Tudo isso é replicável no nosso backend.

---

## Arquitetura proposta no nosso sistema

### Entrada (reestruturada)

- **Descrição** (obrigatório): texto livre do que a pessoa quer postar.
- **Arquivo** (opcional): vídeo ou imagem — tipo detectado automaticamente pelo backend.

### Fluxo único no backend (reestruturado)

```
[Painel] envia multipart: descricao (obrigatório) + arquivo (opcional)
        ↓
[API Fastify]
  1. Recebe e valida (multipart/form-data).
  2. Se há arquivo: detecta tipo pelo mimetype (video/* → Reels, image/* → post de imagem).
  3. Se NÃO há arquivo:
     → Gera legenda + imagem por IA (veja opções abaixo).
     → Salva imagem no MinIO e usa essa URL como “mídia do post”.
  4. Se HÁ arquivo:
     → Upload no MinIO (vídeo ou imagem).
     → (Opcional) Ajuste/formatação da legenda por IA.
  5. URL pública da mídia (MinIO público ou proxy na API).
  6. Instagram Graph API:
     → POST /{ig-user-id}/media (image_url ou video_url, caption, media_type)
     → Reels: espera ~60s → POST media_publish
     → Imagem: POST media_publish em seguida
  7. Não grava em postagens (a raspagem fará isso quando o post estiver no Instagram).
  8. Responde ao painel (sucesso/erro, id do container, etc.).
```

Um único processo, detecção automática, sem gravar publicação duplicada; tabela `postagens` só via raspagem.

---

## Aprovação do caption (e mídia) em tela

**Objetivo:** o caption gerado pela IA (e, quando for o caso, a mídia gerada) ser **exibido em tela para aprovação** antes de publicar. Se o usuário quiser mudar algo, ele informa o que deseja alterar ou melhorar e a IA refaz; o ciclo repete até aprovação.

### Fluxo proposto

1. Usuário preenche a **descrição** (e opcionalmente envia **arquivo** de mídia).
2. Backend (ou webhook n8n) **gera o caption** (e, se não houver arquivo, a **mídia por IA**).
3. O painel **exibe em tela**:
   - Caption proposto (editável ou só leitura, conforme desenho).
   - Preview da mídia (miniatura ou link), quando houver.
4. Usuário pode:
   - **Aprovar** → segue para publicação (MinIO + Graph API).
   - **Solicitar alteração** → informa em texto livre o que quer mudar ou melhorar (ex.: “deixar mais curto”, “incluir hashtag #imoveis”, “tom mais formal”). O painel envia esse feedback ao backend.
5. Backend **refaz o caption** (e, quando a mídia for responsabilidade da IA, pode **refazer a mídia** com base no feedback) e devolve a nova versão.
6. Volta ao passo 3: exibir nova caption (e mídia) em tela. Ciclo repete até o usuário aprovar.
7. Após aprovação → upload no MinIO (se ainda não estiver) → chamada à Graph API para publicar.

### Implementação

- **API:** endpoint para “gerar caption” (ex.: `POST /api/postador/gerar-caption`) recebe descrição + arquivo opcional (ou id da mídia já em MinIO) e retorna `{ caption, media_url? }`. Outro endpoint para “refazer com feedback” (ex.: `POST /api/postador/refazer-caption`) recebe o caption atual (ou id do rascunho), o texto de feedback do usuário e opcionalmente um flag “refazer mídia também”, e retorna nova `{ caption, media_url? }`. O endpoint de **publicar** (ex.: `POST /api/postador/publicar`) recebe o caption aprovado e a mídia (URL ou id) e só então chama MinIO + Graph API.
- **Painel:** após “Gerar”, mostra caption e preview; botões “Aprovar e publicar” e “Quero alterar”. No segundo caso, campo de texto para o feedback e botão “Refazer”; ao receber a nova versão, exibe de novo e repete até aprovação.
- **Mídia por IA:** quando não há arquivo enviado pelo usuário, a IA gera a imagem; o mesmo ciclo de aprovação pode incluir “refazer imagem” com base no feedback (ex.: “mais cores”, “menos texto na imagem”), usando o endpoint de refazer com flag para regenerar mídia.

É possível implementar esse fluxo tanto com IA no backend (Opção A) quanto com webhook n8n (Opção B): o backend orquestra a ida e volta entre painel e o serviço de IA.

---

## Opções para legenda e geração de mídia por IA

### Opção A – Tudo no backend (máximo controle)

- **Legenda + hashtags**: chamada direta à OpenAI (ou outro provedor) a partir da API Fastify.
- **Imagem quando não há mídia**: DALL·E (ou similar) na API → salva no MinIO → usa essa URL no post.
- **Vantagem**: nenhuma dependência do n8n para o Postador; lógica e prompts versionados no nosso código.
- **Requisito**: chave da API OpenAI (ou outro) em variável de ambiente no serviço da API.

### Opção B – Híbrido (qualidade do n8n na IA)

- **Legenda + sugestão de imagem**: API Fastify chama um **webhook do n8n** (ex.: “gerar caption e prompt de imagem”).
- **Imagem quando não há mídia**:  
  - **B1)** n8n devolve só o prompt → backend gera a imagem (DALL·E etc.) e sobe no MinIO; ou  
  - **B2)** n8n gera a imagem e devolve (ex.: URL ou base64) → backend salva no MinIO e usa no post.
- **Resto** (upload MinIO, Graph API, persistência, detecção de tipo): 100% no backend.
- **Vantagem**: reutiliza o que já funciona bem no n8n (agentes, prompts) sem perder controle do fluxo principal.

Recomendação: começar com **Opção A**; se a qualidade da legenda/imagem não for suficiente, introduzir **Opção B** só para o passo de IA.

---

## MinIO em vez de Cloudinary

- **Upload**: API recebe o arquivo (multipart) e envia ao MinIO (SDK S3-compatível).
- **URL para o Instagram**: a Graph API exige URL **publicamente acessível** no momento da chamada. Duas formas:
  1. **Bucket público no MinIO**: política de leitura pública no bucket (ou nos objetos); usamos a URL direta do MinIO (ex.: `https://minio.seudominio.com/bucket/xxx.jpg`).
  2. **Proxy na nossa API**: arquivo fica privado no MinIO; a API gera um link interno (ex.: `https://nossa-api.com/api/postador/media/abc123`) que, quando acessado, busca no MinIO e devolve o arquivo. O Instagram acessa essa URL; precisa de HTTPS e resposta rápida.
- **Recomendação**: bucket público no MinIO (ou subdomínio dedicado) simplifica e evita timeout no Instagram; proxy é alternativa se não quiser expor o MinIO.

---

## Requisitos técnicos no backend

| Componente | Uso |
|------------|-----|
| **@fastify/multipart** | Receber formulário com descrição + arquivo (opcional). |
| **Cliente MinIO (minio ou @aws-sdk/client-s3)** | Upload de vídeo/imagem; URL pública ou proxy. |
| **Instagram Graph API** | Token em config (já temos em Administração). Endpoints: `/{ig-user-id}/media` e `/{ig-user-id}/media_publish`. |
| **OpenAI (ou outro)** | Geração de legenda e de imagem quando não há mídia (Opção A). |
| **PostgreSQL** | Tabela `postagens` só via raspagem; opcional: `log_postador` (ou similar) para histórico e agendamento/cronograma de postagem. |
| **Variáveis de ambiente** | `INSTAGRAM_IG_USER_ID`, token do Instagram (ou ler do config/DB), `MINIO_*`, `OPENAI_API_KEY` (se Opção A). |

Nada disso exige o n8n; o fluxo do Postador fica inteiro no nosso sistema.

---

## Detecção automática de tipo de mídia

- **Arquivo enviado**: usar `mimetype` do multipart (ex.: `video/mp4` → Reels, `image/jpeg` → imagem).
- **Sem arquivo**: fluxo “só texto” → sempre post de **imagem** (gerada por IA) + legenda.
- Um único endpoint (ex.: `POST /api/postador`) trata todos os casos; a rota decide por “tem arquivo?” e “mimetype”.

---

## Implementação atual (100% no nosso sistema, sem n8n)

- **API** (`api/`): geração e refino de caption via **OpenAI/Claude** no backend (`api/src/services/caption.ts`). Rotas: `POST /api/postador/gerar-caption` (multipart: descricao + arquivo → upload MinIO e retorno de `media_url`), `POST /api/postador/refazer-caption`, `POST /api/postador/publicar` (Graph API com token e ig_user_id da config), `GET /api/postador/cronograma` (lista de posts finalizados).
- **Config** persistida em arquivo (`data/config.json`): instagram (access_token, ig_user_id) e empresa (nome). Definida em **Administração** no painel.
- **Cloudinary** (prioridade se configurado): upload em `gerar-caption` com URLs públicas estáveis (como no workflow n8n). Variáveis: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_UPLOAD_PRESET` (ex.: n8nimage). Não expira.
- **MinIO** (fallback): upload de mídia; URL pública. Variáveis: `MINIO_INTERNAL_URL`, `MINIO_PUBLIC_URL`, etc. Se o bucket for privado ou a URL expirar, use Cloudinary.
- **Instagram Graph API**: criação de container (imagem ou Reels) e publicação; Reels aguardam processamento antes de `media_publish`. Credenciais vêm da config (Administração).
- **Cronograma**: cada post publicado é gravado em `data/cronograma.json` ou tabela `postador_cronograma` (PostgreSQL); listado no painel na tela Postador.
- **Painel**: Administração com **Token de acesso** e **ID do usuário Instagram**; Postador com seletor de IA, upload de arquivo, aprovação, publicação e lista de cronograma.

### Recursos adicionais (agendados, mídia por IA, carrossel)

- **Salvar para agendar**: o painel pode salvar um rascunho (caption + mídia) na tabela `postador_agendados` (ou arquivo `data/agendados.json`) sem publicar. Endpoints: `GET /api/postador/agendados`, `POST /api/postador/agendados`, `DELETE /api/postador/agendados/:id`, `POST /api/postador/agendados/:id/publicar` (publica o agendado e remove da lista).
- **Criar mídia com IA**: opção no formulário “Criar mídia com IA” usa **DALL·E 3** para gerar a imagem a partir de instruções (ou da descrição). Endpoint `POST /api/postador/gerar-imagem` (body: `{ prompt }`) retorna `{ media_url }` (upload no Cloudinary). Requer `OPENAI_API_KEY` e Cloudinary configurado.
- **Post por URL do imóvel**: na revisão, se a mídia veio do link, o usuário pode **excluir a imagem**, **gerar nova imagem com IA** (campo de prompt + botão) ou **incluir imagem** (upload). Upload de uma mídia avulsa: `POST /api/postador/upload-midia` (multipart, um arquivo) → retorna `{ media_url }`.
- **Carrossel**: envio de **várias imagens** no mesmo formulário (multipart com vários `arquivo`) gera um post tipo **CAROUSEL** no Instagram. O backend cria um container por imagem (`is_carousel_item=true`), depois o container pai `media_type=CAROUSEL` com `children=...`, aguarda processamento e chama `media_publish`. Publicação aceita `media_urls` (array) em `POST /api/postador/publicar` para carrossel; agendados suportam `media_type: "CAROUSEL"` e `media_urls`.

---

## Próximos passos sugeridos

1. **Criar/estruturar a API**: rota `POST /api/postador` com multipart (descricao + arquivo opcional), validação e orquestração do fluxo.
2. **Integrar MinIO**: config (endpoint, bucket, chaves), upload e geração de URL pública (ou proxy).
3. **Implementar chamadas à Graph API**: criação do container (imagem ou Reels) e publicação; para Reels, espera antes do `media_publish`.
4. **IA no backend (Opção A)**: serviço de legenda + geração de imagem quando não houver mídia. Sem gravar em `postagens` no envio (raspagem cuida disso).
5. **Painel**: tela Postador com formulário (descrição + upload opcional), fluxo de aprovação do caption em tela (exibir → aprovar ou pedir alteração → IA refaz → repetir até aprovar → publicar).
6. **(Opcional)** Persistência `log_postador`: histórico e suporte a agendamento/cronograma (job que publica na `data_agendada`).
7. **(Opcional)** Manter qualidade do n8n na IA: webhook n8n só para “gerar caption” e/ou “gerar imagem” (Opção B).
8. **(Futuro)** Endpoint “por link”: `POST /api/postador/por-link` com URL do imóvel → extrair dados da página → mesmo pipeline de publicação.
