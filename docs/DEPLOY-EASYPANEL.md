# Deploy no EasyPanel – FabriaIA Painel

Guia passo a passo para implantar o painel no [EasyPanel](https://easypanel.io) a partir do repositório GitHub.

---

## Pré-requisitos

- Conta no [GitHub](https://github.com) com o repositório [ftsmazzo/instaragm-tools](https://github.com/ftsmazzo/instaragm-tools) (branch `main`).
- Servidor ou VPS com EasyPanel instalado, ou uso do EasyPanel em nuvem conforme sua oferta.

---

## 1. Conectar o repositório ao EasyPanel

1. Acesse o painel do **EasyPanel** (seu servidor ou instância em nuvem).
2. Crie um **novo app** (ou "New Application" / "Deploy").
3. Escolha **Deploy from GitHub** (ou "Git" / "GitHub").
4. Autorize o EasyPanel a acessar sua conta GitHub (se ainda não autorizou).
5. Selecione:
   - **Repositório:** `ftsmazzo/instaragm-tools`
   - **Branch:** `main`
6. Confirme e avance.

---

## 2. Configurar o build (Dockerfile)

1. O EasyPanel deve detectar o **Dockerfile na raiz** do repositório.
2. Se houver opção de "Build context" ou "Dockerfile path":
   - **Build context:** raiz do repositório (`.` ou deixar padrão).
   - **Dockerfile path:** `Dockerfile` (raiz).
3. O nosso Dockerfile:
   - Faz **build** do frontend em `painel/` (Node 20, `npm install` + `npm run build`).
   - Gera a imagem final com **nginx** servindo os arquivos estáticos em `/usr/share/nginx/html`.
   - Expõe a porta **80**.

Nenhuma variável de ambiente é obrigatória para o painel estático atual (apenas o build do Vite).

---

## 3. Porta e rede

1. Configure o serviço para expor a porta **80** (já definida no Dockerfile com `EXPOSE 80`).
2. No EasyPanel, normalmente você associa um **domínio** ou **subdomínio** ao app (ex.: `painel.seudominio.com`) e opcionalmente HTTPS (Let's Encrypt).

---

## 4. Variáveis de ambiente / build (painel + API)

Para o painel falar com a API em produção, defina **no build** (não em runtime):

- **`VITE_API_URL`** = URL pública da sua API (ex.: `https://api.seudominio.com`).

No EasyPanel: na configuração do app do **painel**, adicione como variável de ambiente **ou** como build arg. O Dockerfile do painel aceita `ARG VITE_API_URL`; se o EasyPanel injetar env no build, use o mesmo nome. Assim o frontend já sai do build apontando para a API correta.

---

## 5. Fazer o deploy

1. Clique em **Deploy** / **Build and deploy**.
2. Acompanhe o log de build:
   - Clone do repo → build da etapa Node (install + build) → cópia para nginx → imagem final.
3. Quando o status ficar **Running** (ou equivalente), o painel estará no ar.

---

## 6. Testar

1. Acesse a URL configurada (domínio ou IP:porta).
2. Você deve ver o **Painel FabriaIA** com o menu lateral (Início, Administração, Postagens, Agentes e leads, Postador, Perfil, WhatsApp).
3. Navegue pelas rotas para confirmar que o React Router e o SPA respondem (incluindo F5 em rotas como `/admin` ou `/postagens`).

O nginx está configurado com `try_files $uri $uri/ /index.html`, então o refresh em qualquer rota cai no `index.html` e o React cuida do roteamento.

---

## 7. Atualizações (re-deploy)

- **Push na branch `main`:** no EasyPanel, use a opção de **Redeploy** ou **Rebuild** (conforme disponível) para puxar o novo código e fazer o build de novo.
- Se o EasyPanel tiver **webhook** ou **auto-deploy on push**, configure no repositório GitHub (Settings → Webhooks) para automatizar.

---

## Resumo rápido

| Item            | Valor / Ação                                      |
|-----------------|---------------------------------------------------|
| Repositório     | `https://github.com/ftsmazzo/instaragm-tools`     |
| Branch          | `main`                                            |
| Dockerfile      | Raiz do repositório                               |
| Porta           | 80                                                |
| Variáveis       | Nenhuma obrigatória no estado atual               |
| Saída           | SPA React servido por nginx                       |

Se algo falhar no build (ex.: erro de `npm install` ou `npm run build`), confira o log completo no EasyPanel; a maioria dos problemas vem de caminho do Dockerfile ou de branch errada.

---

## 8. Deploy da API (segundo app)

Para subir a **API** (Fastify) no mesmo EasyPanel:

1. Crie **outro app** no EasyPanel, também conectado ao repositório `ftsmazzo/instaragm-tools`, branch `main`.
2. Configure o build:
   - **Build context:** `api` (ou o caminho relativo até a pasta `api`).
   - **Dockerfile path:** `Dockerfile` (dentro de `api/`), ou seja, context `api`, Dockerfile `api/Dockerfile`.
3. Porta do serviço: **3000** (já exposta no Dockerfile da API).
4. Variáveis de ambiente: `PORT=3000`, `NODE_ENV=production`. Para o botão **Raspar postagens** funcionar, defina `N8N_WEBHOOK_RASPAR_POSTAGENS` com a URL **interna** do webhook n8n (a API roda dentro do EasyPanel e não resolve o domínio público). Use o nome do app n8n e a porta interna, ex.: `http://fabricaia-n8n:5678/webhook/raspar_postagens` (troque `fabricaia-n8n` e `5678` pelo nome e porta do seu app n8n no painel).
5. Deploy. A API ficará disponível em `https://seu-dominio-api...` ou no IP:3000 conforme configurado.
6. No painel (frontend), configure `VITE_API_URL` apontando para essa URL da API no próximo passo (ver item B no projeto).
