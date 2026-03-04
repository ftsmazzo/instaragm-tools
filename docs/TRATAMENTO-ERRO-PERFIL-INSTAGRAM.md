# Tratamento de erro na requisição de perfil do usuário (Instagram Graph API)

Quando você chama o endpoint de perfil do usuário:

```
GET https://graph.instagram.com/v24.0/{user-id}?fields=username,name,is_user_follow_business,is_business_follow_user,follower_count,profile_pic
```

alguns usuários podem retornar erro. Este doc explica os erros e como **contornar** no n8n e **devolver uma informação controlada** em vez de quebrar o fluxo.

---

## 1. Erros comuns e o que significam

| HTTP | Código Meta | Subcode | Significado | Como lidar |
|------|-------------|---------|-------------|------------|
| 400  | 100         | 33      | Objeto não existe, falta permissão ou operação não suportada (ex.: ID inválido, perfil restrito, usuário sem consentimento) | Tratar como “perfil indisponível” e seguir com fallback |
| 500  | 230         | —       | **User consent is required to access user profile** — o usuário não autorizou o app a acessar o perfil | Tratar como “perfil indisponível” e seguir com fallback |

Resumo: em ambos os casos você **não** vai ter os dados do perfil. A solução é **não deixar o workflow quebrar** e **devolver um objeto padrão** (ex.: “Perfil indisponível”) para o resto da automação usar.

---

## 2. Contornar no n8n (não quebrar o fluxo)

### 2.1. Nó HTTP Request (LeadInfosComment ou equivalente)

1. Abra o nó que faz o GET para `graph.instagram.com/.../{user-id}?fields=...`.
2. Nas **configurações do nó** (ícone de engrenagem ou "Settings" / "Opções"):
   - Ative **"Continue On Fail"** (ou **"On Error"** → **"Continue (using error output)"**).
3. Assim, quando a API retornar 400 ou 500, o nó **não interrompe** o workflow e envia o item para a **saída de erro** (error output).

### 2.2. Duas saídas do HTTP Request

- **Saída normal (output):** resposta 200 com dados do perfil.
- **Saída de erro (error output):** quando dá 400/500 (ou outro erro). O n8n costuma colocar detalhes do erro no item (ex.: `$json.error`, `$json.message`, `$json.code`).

Conecte:
- A **saída normal** ao fluxo que **usa** os dados do perfil (ex.: agente, Set, etc.).
- A **saída de erro** a um fluxo que **monta o fallback** (objeto “perfil indisponível”) e depois **converge** com o fluxo principal (Merge ou próximo nó comum).

---

## 3. Devolver informação controlada (fallback)

Objetivo: quando o GET de perfil falhar, o resto do workflow ainda receba um objeto fixo, por exemplo:

- `profile_available: false`
- `username`, `name` etc. com valores como `"Não disponível"` ou `"Perfil indisponível"`.
- Opcional: `error_code` e `error_reason` para log ou suporte.

### 3.1. Exemplo de objeto de fallback (JSON)

Use isso no nó **Set** (ou Code) que trata a **saída de erro** do HTTP Request:

```json
{
  "profile_available": false,
  "username": "Não disponível",
  "name": "Perfil indisponível",
  "is_user_follow_business": null,
  "is_business_follow_user": null,
  "follower_count": null,
  "profile_pic": null,
  "error_code": "{{ $json.code || $json.error?.code || 'unknown' }}",
  "error_reason": "Perfil não acessível (consentimento ou permissão)"
}
```

Assim, o agente (ou qualquer nó depois) pode:
- Verificar `profile_available === false` e evitar depender de `username`/`name` reais.
- Usar `username: "Não disponível"` em mensagens ou logs.
- Opcionalmente registrar `error_code` / `error_reason` para diagnóstico.

### 3.2. Unir “sucesso” e “fallback” no mesmo formato

Para que o resto do fluxo trate só um tipo de objeto:

- No ramo de **sucesso** (resposta 200): use um **Set** (ou Code) para mapear a resposta da API para o mesmo formato (ex.: `profile_available: true`, `username`, `name`, etc.).
- No ramo de **erro**: use o Set com o JSON de fallback acima.

Depois, use um **Merge** (modo “Append” ou “Combine”) para juntar os dois ramos em um só e seguir para o Agente de Comentários/Direct. Assim, tanto em sucesso quanto em erro você “devolve” uma informação controlada.

---

## 4. Fluxo resumido

```
[Antes: você tem o user-id do comentário/DM]
        │
        ▼
[HTTP Request] GET graph.instagram.com/.../{user-id}?fields=...
        │       Config: "Continue On Fail" = ON
        │
        ├── Saída normal (200) ──► [Set] formata perfil (profile_available: true, username, name, ...)
        │                                    │
        └── Saída de erro (4xx/5xx) ──► [Set] fallback (profile_available: false, username: "Não disponível", ...)
                                                        │
                                                        ▼
                                              [Merge] junta os dois ramos
                                                        │
                                                        ▼
                                              [Próximo nó: Agente / resposta ao usuário]
```

No Agente (ou no nó que monta a resposta), use algo como:

- Se `profile_available === false`: não use dados sensíveis do perfil; use apenas “usuário” ou “Perfil indisponível” na mensagem.
- Se `profile_available === true`: use `username` / `name` normalmente.

---

## 5. Por que alguns usuários dão erro

- **230 – User consent:** o usuário não autorizou o app a ler o perfil (comum quando ele só comentou ou mandou DM, sem aceitar permissões extras).
- **100 + subcode 33:** ID inexistente, perfil restrito, conta desativada ou token/permissão do app insuficiente.

Não dá para “forçar” o perfil sem consentimento. O contorno correto é **tratar o erro** e **devolver uma informação padrão** (como acima) para o resto da automação.

---

## 6. Checklist rápido

- [ ] HTTP Request com **Continue On Fail** ativado.
- [ ] **Saída de erro** do HTTP conectada a um nó (Set/Code) que monta o fallback.
- [ ] Fallback com pelo menos `profile_available: false` e `username`/`name` fixos.
- [ ] **Merge** (ou lógica equivalente) para unir sucesso e fallback antes do Agente.
- [ ] No Agente, checar `profile_available` antes de usar dados do perfil.
