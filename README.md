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
├── api/             # API Fastify (health, Postador: gerar/refazer caption, publicar)
├── docs/            # Documentação (webhooks, Postador, deploy)
├── Dockerfile       # Build e run do painel
├── .gitignore
└── README.md
```

## Postador (primeira versão)

- **Painel:** tela Postador com descrição, botão "Gerar caption", revisão do caption em tela, opção "Quero alterar" (feedback para refazer) e "Aprovar e publicar".
- **API:** `POST /api/postador/gerar-caption` (JSON `{ descricao }`), `POST /api/postador/refazer-caption` (JSON `{ caption_atual, feedback }`), `POST /api/postador/publicar` (JSON `{ caption }`). Por ora respostas mock (sem MinIO, sem IA real, sem Instagram Graph API). Ver `docs/POSTADOR-BACKEND.md` para evolução (MinIO, IA, agendamento).

## Como rodar local

**Painel:**
```bash
cd painel
pnpm install
pnpm dev
```

**API (Postador, health):**
```bash
cd api
npm install
npm run dev
```
A API sobe em `http://localhost:3000`. No painel, configure `VITE_API_URL=http://localhost:3000` (arquivo `.env` na pasta `painel/`) para apontar para a API local.

## Deploy (EasyPanel)

1. Repositório no GitHub com este código.
2. No EasyPanel: novo app → Deploy from GitHub → selecionar repo e branch.
3. Build: Dockerfile na raiz (ou caminho configurado).
4. Variáveis de ambiente no painel do EasyPanel.
