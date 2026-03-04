# Onde ficam a configuração e os dados (config, cronograma)

## Resumo

- **Configuração do Instagram e da empresa** (token, ig_user_id, nome) e o **cronograma** de posts publicados podem ser gravados **no PostgreSQL** ou em arquivo.
- Você **não precisa preencher em todo post**: configure **uma vez** em **Administração** (token + ID do usuário Instagram) e clique em **Salvar**. A API reutiliza esses dados em todas as publicações.

---

## Como a API decide onde gravar

| Situação | Onde grava |
|----------|------------|
| **`DATABASE_URL` definida** (ex.: no EasyPanel, variável de ambiente da API) | **PostgreSQL**: tabelas `app_config` e `postador_cronograma`. Nada de volume nem mudança de estrutura no EasyPanel. |
| **`DATABASE_URL` não definida** (ex.: rodar a API local sem banco) | **Arquivos** em `data/config.json` e `data/cronograma.json`. |

Ou seja: basta definir a variável **`DATABASE_URL`** no serviço da API (conexão ao PostgreSQL que você já usa). A API cria as tabelas na primeira vez que precisar e passa a persistir config e cronograma no banco.

---

## Tabelas no banco (quando usa PostgreSQL)

- **`app_config`** — chave `config`, valor em JSON: `instagram` (access_token, ig_user_id) e `empresa` (nome).
- **`postador_cronograma`** — cada linha é um post publicado: id, caption, media_url, media_type, id_container, link_post, data_post, created_at.

As tabelas são criadas automaticamente pela API (`CREATE TABLE IF NOT EXISTS`) ao usar config ou cronograma.

---

## O que fazer no EasyPanel

- **Só adicionar uma variável de ambiente** no serviço da API: **`DATABASE_URL`** com a connection string do PostgreSQL (ex.: `postgresql://user:senha@host:5432/nome_do_banco`).
- Não é preciso criar volume, nem alterar estrutura de outros projetos. A persistência fica no banco.

---

## Resumo prático

1. **Onde:** com `DATABASE_URL` → PostgreSQL (tabelas `app_config` e `postador_cronograma`). Sem `DATABASE_URL` → arquivos em `data/`.
2. **Preencher toda vez?** Não. Uma vez em Administração e Salvar; a API usa sempre essa config.
3. **Para persistir no EasyPanel sem volume:** defina `DATABASE_URL` no app da API.
