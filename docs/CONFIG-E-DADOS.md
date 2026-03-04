# Onde ficam a configuração e os dados (config, cronograma)

## Resumo

- **Configuração do Instagram e da empresa** (token, ig_user_id, nome) e o **cronograma** de posts publicados **não usam tabela no banco**. Ficam em **arquivos JSON** dentro da pasta `data/` da API.
- Você **não precisa preencher em todo post**: configure **uma vez** em **Administração** (token + ID do usuário Instagram) e clique em **Salvar**. A API grava e reutiliza esses dados em todas as publicações.

---

## Onde está salvo

| Dado | Arquivo | Conteúdo |
|------|---------|----------|
| Config (Instagram + empresa) | `data/config.json` | `instagram.access_token`, `instagram.ig_user_id`, `empresa.nome` |
| Cronograma (posts publicados) | `data/cronograma.json` | Lista de itens com caption, media_url, link_post, data_post, etc. |

O caminho completo depende do `DATA_DIR` (variável de ambiente). Padrão: **`<raiz do projeto da API>/data/`**.  
Em Docker, a raiz costuma ser `/app`, então os arquivos ficam em **`/app/data/config.json`** e **`/app/data/cronograma.json`**.

---

## Por que não aparece tabela no banco?

A config e o cronograma foram implementados em arquivo para não depender de PostgreSQL no início. O projeto já prevê PostgreSQL para outras coisas (ex.: postagens da raspagem); se no futuro quiser migrar config e cronograma para o banco, dá para criar tabelas e passar a ler/gravar lá.

---

## Persistência no EasyPanel (Docker)

Se o serviço da API **não** tiver um **volume** montado na pasta `data/`, essa pasta é **efêmera**: quando o container reinicia, os arquivos são perdidos e você precisaria preencher de novo em Administração.

**Recomendação:** no EasyPanel, no app da **API**, configure um **volume**:

- **Mount path (no container):** `/app/data`
- **Volume:** use um volume nomeado (ex.: `instagram-api-data`) ou um host path

Assim `config.json` e `cronograma.json` sobrevivem a restarts e você configura o Instagram **uma vez**; as publicações seguem usando essa config até você alterar em Administração.

---

## Resumo prático

1. **Onde:** config e cronograma = arquivos em `data/` (não há tabela no banco para isso).
2. **Preencher toda vez?** Não. Preencha **uma vez** em Administração e Salvar; a API usa esse arquivo em todos os posts.
3. **Para não perder ao reiniciar:** monte volume em `/app/data` no container da API no EasyPanel.
