# -*- coding: utf-8 -*-
"""Atualiza workflow n8n exportado (JSON) para schema CRM multi-tenant (api/migrations/004_agent_crm_tables.sql).

Uso:
  python scripts/patch_n8n_multitenant.py
  python scripts/patch_n8n_multitenant.py caminho/seu-workflow.json
  python scripts/patch_n8n_multitenant.py entrada.json saida.json

Exige nós com os mesmos nomes do workflow de referência (GravaComentario, DadosPost, …).
Se renomeou nós, avise ou readicione os nomes no script.

No workflow Agente-Postador.json, o nó HTTP **API**:
  • URL no próprio nó: troque SUBSTITUA_PELO_SEU_BACKEND pela URL da API (sem barra antes de /api).
  • Autenticação: Generic > Header Auth — crie credencial "Header Auth" com nome do header
    X-Internal-Secret e valor = INTERNAL_AGENT_API_SECRET da API (não use $env se N8N_BLOCK_ENV_ACCESS_IN_NODE estiver ativo).

Banco zerado: subir a API primeiro (ensureTables cria o schema). Cadastrar organização + conta Instagram no painel
antes de receber webhooks; senão GET /api/internal/agent-config e INSERTs que usam instagram_accounts falham.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WF = ROOT / "Agente-Instagram ImobMiq.json"

DDL_STUB = """-- Tabelas multi-tenant já criadas pela API (api/migrations/004_agent_crm_tables.sql).
-- Não executar CREATE aqui em produção.
SELECT 1 AS ok;"""

Q_GRAVA_COMENT = """-- INSERT comentário – Webhook Instagram (multi-tenant)
-- Resolve organization_id + instagram_account_id pela conta IG (entry[0].id = ig_user_id).
-- ON CONFLICT atualiza texto/username para o mesmo comentário (retry) e devolve linha.

INSERT INTO comentarios (
  organization_id,
  instagram_account_id,
  id_postagem,
  id_comentario,
  media_type,
  id_insta_lead,
  username_lead,
  comment_text,
  interaction_type,
  origem,
  data_comentario
)
SELECT
  ia.organization_id,
  ia.id,
  '{{ $('Webhook').item.json.body.entry[0].changes[0].value.media.id }}',
  '{{ $('Webhook').item.json.body.entry[0].changes[0].value.id }}',
  '{{ $('Webhook').item.json.body.entry[0].changes[0].value.media.media_product_type }}',
  '{{ $('Webhook').item.json.body.entry[0].changes[0].value.from.id }}',
  '{{ $('Webhook').item.json.body.entry[0].changes[0].value.from.username }}',
  '{{ $('Webhook').item.json.body.entry[0].changes[0].value.text }}',
  '{{ $('Webhook').item.json.body.entry[0].changes[0].field }}',
  '{{ $('Webhook').item.json.body.object }}',
  to_timestamp({{ $('Webhook').item.json.body.entry[0].time }}) AT TIME ZONE 'UTC'
FROM instagram_accounts ia
WHERE ia.ig_user_id = '{{ $('Webhook').item.json.body.entry[0].id }}'
LIMIT 1
ON CONFLICT (organization_id, id_comentario) DO UPDATE SET
  username_lead = EXCLUDED.username_lead,
  comment_text = EXCLUDED.comment_text
RETURNING id, id_comentario, id_postagem, username_lead, comment_text, data_comentario, organization_id, instagram_account_id;"""

Q_DADOS_POST = """SELECT p.id_post, p.caption_post, p.media_type, p.media_url, p.link_post, p.data_post,
       p.media_description, p.hashtags, p.mencoes, p.organization_id
FROM postagens p
INNER JOIN instagram_accounts ia
  ON ia.organization_id = p.organization_id
  AND ia.ig_user_id = '{{ $('Webhook').item.json.body.entry[0].id }}'
WHERE p.id_post = '{{ $('Webhook').item.json.body.entry[0].changes[0].value.media.id }}'
LIMIT 1;"""

Q_GRAVA_DIRECT = """-- INSERT Direct – Webhook (multi-tenant)

INSERT INTO direct (
  organization_id,
  instagram_account_id,
  id_direct,
  id_insta_lead,
  username_lead,
  direct_text,
  interaction_type,
  origem,
  data_direct
)
SELECT
  ia.organization_id,
  ia.id,
  '{{ $('Webhook').item.json.body.entry[0].messaging[0].message.mid }}',
  '{{ $('Webhook').item.json.body.entry[0].messaging[0].sender.id }}',
  '{{ $json.username }}',
  '{{ $('Webhook').item.json.body.entry[0].messaging[0].message.text }}',
  'Direct',
  '{{ $('Webhook').item.json.body.object }}',
  to_timestamp(({{ $('Webhook').item.json.body.entry[0].messaging[0].timestamp }}) / 1000.0) AT TIME ZONE 'UTC'
FROM instagram_accounts ia
WHERE ia.ig_user_id = '{{ $('Webhook').item.json.body.entry[0].id }}'
LIMIT 1
ON CONFLICT (organization_id, id_direct) DO UPDATE SET
  username_lead = EXCLUDED.username_lead,
  direct_text = EXCLUDED.direct_text
RETURNING id, id_direct, id_insta_lead, username_lead, direct_text, data_direct, organization_id;"""

Q_VERIFICA_POST = """SELECT d.id_comentario_origem, d.id_direct, d.created_at, d.organization_id
FROM public.direct d
INNER JOIN instagram_accounts ia
  ON ia.organization_id = d.organization_id
  AND ia.ig_user_id = '{{ $('Webhook').item.json.body.entry[0].id }}'
WHERE d.id_insta_lead = '{{ $('LeadInfosDirect').item.json.id }}'
  AND d.enviado_pelo_negocio = true
  AND d.id_comentario_origem IS NOT NULL
ORDER BY d.created_at DESC
LIMIT 1;"""

Q_BUSCA_POST = """SELECT c.id_comentario, c.id_postagem, c.comment_text, c.media_type, c.data_comentario, c.organization_id
FROM public.comentarios c
WHERE c.id_comentario = '{{ $json.id_comentario_origem }}'
  AND c.organization_id = '{{ $json.organization_id }}'::uuid;"""

Q_DADOS_POST1 = """SELECT p.id_post, p.caption_post, p.media_type, p.media_url, p.link_post, p.data_post,
       p.media_description, p.hashtags, p.mencoes, p.organization_id
FROM postagens p
WHERE p.id_post = '{{ $json.id_postagem }}'
  AND p.organization_id = '{{ $json.organization_id }}'::uuid
LIMIT 1;"""


def find_node(nodes, name):
    for n in nodes:
        if n.get("name") == name:
            return n
    raise KeyError(name)


def patch(input_path: Path, output_path: Path | None = None) -> None:
    output_path = output_path or input_path
    data = json.loads(input_path.read_text(encoding="utf-8"))
    nodes = data["nodes"]

    # GravaComentario
    n = find_node(nodes, "GravaComentario")
    n["parameters"] = {"operation": "executeQuery", "query": Q_GRAVA_COMENT, "options": {}}

    # DadosPost: executeQuery em vez de select UI
    n = find_node(nodes, "DadosPost")
    n["parameters"] = {"operation": "executeQuery", "query": Q_DADOS_POST, "options": {}}

    # DadosInteraction: organization_id + instagram_account_id
    n = find_node(nodes, "DadosInteraction")
    assigns = n["parameters"]["assignments"]["assignments"]
    extra = [
        {
            "id": "org-mt-1",
            "name": "organization_id",
            "value": "={{ $json.organization_id || $('GravaComentario').item.json.organization_id }}",
            "type": "string",
        },
        {
            "id": "org-mt-2",
            "name": "instagram_account_id",
            "value": "={{ $('GravaComentario').item.json.instagram_account_id }}",
            "type": "string",
        },
    ]
    # Evitar duplicar se reexecutar script
    existing = {a.get("name") for a in assigns}
    for e in extra:
        if e["name"] not in existing:
            assigns.append(e)

    # GravaDirect
    n = find_node(nodes, "GravaDirect")
    n["parameters"] = {"operation": "executeQuery", "query": Q_GRAVA_DIRECT, "options": {}}

    # VerificaPost
    n = find_node(nodes, "VerificaPost")
    n["parameters"]["query"] = Q_VERIFICA_POST

    # BuscaPost
    n = find_node(nodes, "BuscaPost")
    n["parameters"]["query"] = Q_BUSCA_POST

    # DadosPost1
    n = find_node(nodes, "DadosPost1")
    n["parameters"] = {"operation": "executeQuery", "query": Q_DADOS_POST1, "options": {}}

    # DadosInteraction2
    n = find_node(nodes, "DadosInteraction2")
    assigns = n["parameters"]["assignments"]["assignments"]
    extra2 = [
        {
            "id": "org-mt-3",
            "name": "organization_id",
            "value": "={{ $json.organization_id }}",
            "type": "string",
        },
    ]
    existing2 = {a.get("name") for a in assigns}
    for e in extra2:
        if e["name"] not in existing2:
            assigns.append(e)

    # Atualiza-Comentarios: matching org + id_comentario
    n = find_node(nodes, "Atualiza-Comentarios")
    cols = n["parameters"]["columns"]
    # Valores para WHERE (matching) + colunas a atualizar; n8n usa matchingColumns para identificar a linha
    cols["value"]["organization_id"] = "={{ $('DadosInteraction').item.json.organization_id }}"
    cols["matchingColumns"] = ["organization_id", "id_comentario"]
    schema = cols["schema"]
    # Inserir organization_id no schema se não existir
    if not any(x.get("id") == "organization_id" for x in schema):
        schema.insert(
            2,
            {
                "id": "organization_id",
                "displayName": "organization_id",
                "required": True,
                "defaultMatch": False,
                "display": True,
                "type": "string",
                "canBeUsedToMatch": True,
                "removed": False,
            },
        )

    # Grava-Reply (direct enviado pelo negócio)
    n = find_node(nodes, "Grava-Reply")
    n["parameters"]["operation"] = "upsert"
    cols = n["parameters"]["columns"]
    cols["value"]["organization_id"] = "={{ $('DadosInteraction').item.json.organization_id }}"
    cols["value"]["instagram_account_id"] = "={{ $('DadosInteraction').item.json.instagram_account_id }}"
    cols["matchingColumns"] = ["organization_id", "id_direct"]
    sch = cols["schema"]
    if not any(x.get("id") == "organization_id" for x in sch):
        sch.insert(
            1,
            {
                "id": "organization_id",
                "displayName": "organization_id",
                "required": True,
                "defaultMatch": False,
                "display": True,
                "type": "string",
                "canBeUsedToMatch": True,
                "removed": False,
            },
        )
    if not any(x.get("id") == "instagram_account_id" for x in sch):
        sch.insert(
            2,
            {
                "id": "instagram_account_id",
                "displayName": "instagram_account_id",
                "required": False,
                "defaultMatch": False,
                "display": True,
                "type": "string",
                "canBeUsedToMatch": False,
            },
        )

    # cadastrar_lead tool
    n = find_node(nodes, "cadastrar_lead")
    cols = n["parameters"]["columns"]
    cols["value"]["organization_id"] = "={{ $('DadosInteraction2').item.json.organization_id }}"
    cols["matchingColumns"] = ["organization_id", "id_instagram"]
    sch = cols["schema"]
    if not any(x.get("id") == "organization_id" for x in sch):
        sch.insert(
            1,
            {
                "id": "organization_id",
                "displayName": "organization_id",
                "required": True,
                "defaultMatch": False,
                "display": True,
                "type": "string",
                "canBeUsedToMatch": True,
                "removed": False,
            },
        )

    # consulta_lead
    n = find_node(nodes, "consulta_lead")
    wh = n["parameters"].setdefault("where", {"values": []})
    vals = wh["values"]
    if not any(v.get("column") == "organization_id" for v in vals):
        vals.append(
            {
                "column": "organization_id",
                "value": "={{ $('DadosInteraction2').item.json.organization_id }}",
            }
        )

    # DadosDirect: filtrar por org (evita colisão multi-tenant)
    n = find_node(nodes, "DadosDirect")
    wh = n["parameters"].setdefault("where", {"values": []})
    vals = wh["values"]
    if not any(v.get("column") == "organization_id" for v in vals):
        vals.append(
            {
                "column": "organization_id",
                "value": "={{ $json.organization_id }}",
            }
        )

    # Nós DDL → stub
    for name in ("Comentarios", "LEAD"):
        try:
            n = find_node(nodes, name)
            if n["parameters"].get("operation") == "executeQuery":
                n["parameters"]["query"] = DDL_STUB
        except KeyError:
            pass

    # Nó que tinha CREATE postagens / direct (nomes no grep: sem nome único — procurar por CREATE TABLE postagens)
    for n in nodes:
        q = n.get("parameters", {}).get("query")
        if isinstance(q, str) and "CREATE TABLE IF NOT EXISTS public.postagens" in q:
            n["parameters"]["query"] = DDL_STUB
        if isinstance(q, str) and "CREATE TABLE IF NOT EXISTS public.direct" in q and n.get("name") not in (
            "GravaDirect",
        ):
            n["parameters"]["query"] = DDL_STUB
        if isinstance(q, str) and "CREATE TABLE IF NOT EXISTS public.leads" in q:
            n["parameters"]["query"] = DDL_STUB

    output_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("OK:", output_path)


def main() -> None:
    ap = argparse.ArgumentParser(description="Adequa workflow n8n ao CRM multi-tenant.")
    ap.add_argument(
        "input",
        nargs="?",
        type=Path,
        default=DEFAULT_WF,
        help=f"JSON exportado do n8n (default: {DEFAULT_WF.name})",
    )
    ap.add_argument("output", nargs="?", type=Path, default=None, help="Arquivo de saída (default: sobrescreve entrada)")
    args = ap.parse_args()
    inp = args.input.resolve()
    if not inp.is_file():
        print(f"Arquivo não encontrado: {inp}", file=sys.stderr)
        sys.exit(1)
    try:
        patch(inp, args.output.resolve() if args.output else None)
    except KeyError as e:
        print(
            f"Nó obrigatório ausente ou nome diferente: {e!s}. "
            "Confira se o workflow usa os mesmos nomes de nó (ex.: GravaComentario, DadosPost).",
            file=sys.stderr,
        )
        sys.exit(2)


if __name__ == "__main__":
    main()
