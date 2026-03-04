# FabriaIA – Agente Instagram & Painel

Painel web para configurar e operar: Agente de Comentários/Direct no Instagram, Raspagem de Postagens, Postador Automático, disparos WhatsApp e monitoramento de leads/conversas.

## Stack

| Camada      | Tecnologia |
|------------|------------|
| Frontend   | React 18 + TypeScript + Vite |
| UI         | Tailwind CSS + Radix UI (ou shadcn/ui) |
| Roteamento | React Router v6 |
| Backend    | Node.js + Fastify (API REST) |
| Banco      | PostgreSQL (já usado nos workflows n8n) |
| Deploy     | Docker + EasyPanel (build a partir do GitHub) |

## Regras de trabalho

- **Código:** todo desenvolvimento é commitado e enviado (push) para o repositório GitHub.
- **Deploy:** você implanta no EasyPanel conectando o repositório GitHub e usando o Dockerfile; cada serviço (painel, API se separar depois) pode ser um app no EasyPanel.
- **Organização:** frontend em `painel/`, API em `api/`, documentação em `docs/`, scripts e Docker na raiz.

## Estrutura (visão)

```
Agente-Instagram/
├── painel/          # Frontend React (Vite)
├── api/             # API Fastify (health, config, postagens, agentes, Postador)
├── docs/            # Documentação (webhooks, Postador, deploy)
├── Dockerfile       # Build e run do painel
├── .gitignore
└── README.md
```

## Postador

- **Painel:** tela Postador com descrição, upload opcional de imagem/vídeo, seletor de IA (OpenAI/Claude e modelo), "Gerar caption", revisão e "Quero alterar" ou "Aprovar e publicar". Lista de **cronograma** (posts já publicados) na mesma tela.
- **Administração:** em Administração configure o **token de acesso** e o **ID do usuário Instagram** (Graph API) para permitir publicar. Esses dados são gravados em arquivo (`data/config.json`), não em tabela; configure **uma vez** e a API usa em todos os posts. Ver `docs/CONFIG-E-DADOS.md` (persistência e volume no EasyPanel).
- **API:** `POST /api/postador/gerar-caption` (multipart: descricao + arquivo → MinIO e caption por IA), `POST /api/postador/refazer-caption`, `POST /api/postador/publicar` (Graph API), `GET /api/postador/cronograma`. Config e cronograma persistidos em `data/` (configurar MinIO e variáveis; ver `api/.env.example` e `docs/POSTADOR-BACKEND.md`).

## Como rodar local

**Painel (frontend):**
```bash
cd painel
pnpm install
pnpm dev
```
Crie `painel/.env` com `VITE_API_URL=http://localhost:3000` para apontar para a API. Em produção, defina `VITE_API_URL` no build (ex.: EasyPanel).

**API (backend):**
```bash
cd api
npm install
npm run dev
```
A API sobe em `http://localhost:3000`. Endpoints: `GET /health`, `GET/PUT /api/config`, `GET /api/postagens`, `POST /api/postagens/raspar`, `GET /api/postador/cronograma`, `POST /api/postador/gerar-caption`, `POST /api/postador/refazer-caption`, `POST /api/postador/publicar`. Para mídia no Postador, configure MinIO; para publicar no Instagram, preencha token e ig_user_id em Administração.

## Deploy (EasyPanel)

1. Repositório no GitHub com este código.
2. No EasyPanel: novo app → Deploy from GitHub → selecionar repo e branch.
3. Build: Dockerfile na raiz (ou caminho configurado).
4. Variáveis de ambiente no painel do EasyPanel.
