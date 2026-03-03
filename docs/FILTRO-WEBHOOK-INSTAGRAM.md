# Filtro + Rotas – Webhook Instagram (Agente Comentários + Agente Direct)

Objetivo: **só passar para a próxima etapa** os eventos que interessam (comentários e mensagens de usuário no Direct), **bloqueando** o resto. Depois do filtro, **duas rotas**: uma para o **Agente de Comentários** e outra para o **Agente de Direct**.

---

## 1. O que você NÃO quer receber (bloquear no filtro)

Tudo que não for “comentário” ou “mensagem de usuário no Direct” deve ser barrado para não contaminar o sistema:

| Tipo de evento | O que é | Barrado? |
|----------------|--------|----------|
| **Echo** | Quando **a sua IA/resposta** volta no webhook (mensagem enviada pela sua conta no Direct) | ✅ Sim |
| **message_reactions** | Usuário clica no **coração** (ou outro emoji) **em cima de uma mensagem no Direct** — é reação à mensagem na conversa, não like no post do feed | ✅ Sim |
| **messaging_handover** | Passagem de controle de thread entre apps | ✅ Sim |
| **message_edit** | Mensagem editada no Direct | ✅ Sim (se não for seu caso de uso) |
| **mentions** | @menção em comentário/caption | ✅ Sim (a menos que queira tratar como comentário) |
| **story_insights** | Métricas de story | ✅ Sim |
| **messaging_seen**, **postbacks**, etc. | Outros eventos de messaging | ✅ Sim |

**Resumo:** “Reaction” = reação **à mensagem no Direct** (coração na DM). Não é like no post do feed. Você não precisa processar isso no agente, então barramos.

---

## 2. O que você QUER passar (útil para os agentes)

| Tipo | field | Passar? | Rota depois do filtro |
|------|--------|--------|-------------------------|
| Comentário em post/mídia | `comments` | ✅ Sim | **Agente de Comentários** |
| Comentário em live | `live_comments` | ✅ Sim | **Agente de Comentários** |
| Mensagem de usuário no Direct (não é a sua resposta) | `messages` e **não echo** | ✅ Sim | **Agente de Direct** |

Ou seja:
- **Filtro:** deixa passar só `object === "instagram"` + `field` em `comments` | `live_comments` | `messages` + para `messages` exige “não echo”.
- **Depois do filtro:** uma rota para **comentários** (comments + live_comments) e outra para **Direct** (messages já sem echo).

---

## 3. Estrutura do payload (Instagram)

Body do POST (ex.: em `$json.body` no n8n):

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "<instagram-account-id>",
      "time": 1520383571,
      "changes": [
        {
          "field": "comments",
          "value": { "from": {...}, "id": "...", "text": "...", "media": {...}, "parent_id": "..." }
        }
      ]
    }
  ]
}
```

Para Direct (mensagem de usuário):

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "<instagram-account-id>",
      "time": 1520383571,
      "changes": [
        {
          "field": "messages",
          "value": {
            "sender": {"id": "..."},
            "recipient": {"id": "..."},
            "timestamp": 1234567890,
            "message": {
              "mid": "...",
              "text": "...",
              "is_echo": false
            }
          }
        }
      ]
    }
  ]
}
```

Quando **a IA responde**, o mesmo `field: "messages"` vem com `value.message.is_echo: true` → o filtro deve **não** deixar passar (evitar processar echo).

Referência: [Webhooks Reference: Instagram - Meta for Developers](https://developers.facebook.com/docs/graph-api/webhooks/reference/instagram/)

---

## 4. Filtro objetivo (recomendado) – 1 condição só

Os dois tipos de payload são diferentes:

- **Comentário:** `body.entry[0].changes[0].field === "comments"` (ou `"live_comments"`). Não existe `messaging`.
- **Direct:** `body.entry[0].messaging[0]` com `message.mid` e `message.text`. O **`mid`** é o identificador da mensagem no Direct; usar ele evita confusão com outros eventos.

Para não misturar caminhos (`messaging` vs `changes`) e não depender de vários OR frágeis, use **uma única condição de expressão** no n8n:

| Tipo | Left (Expression) | Operador | Right |
|------|-------------------|----------|--------|
| Expression | Ver bloco abaixo | equals | `true` |

**Expression (copiar para o n8n):**

```javascript
{{ $json.body.object === 'instagram' && (
  $json.body.entry[0].changes && $json.body.entry[0].changes[0] && 
  ($json.body.entry[0].changes[0].field === 'comments' || $json.body.entry[0].changes[0].field === 'live_comments')
) || (
  $json.body.entry[0].messaging && $json.body.entry[0].messaging[0] && 
  $json.body.entry[0].messaging[0].message && 
  $json.body.entry[0].messaging[0].message.mid && 
  $json.body.entry[0].messaging[0].message.is_echo !== true
) }}
```

- **Comentário:** passa se `object === 'instagram'` e `changes[0].field` for `comments` ou `live_comments`.
- **Direct:** passa se existir `messaging[0].message.mid` (só DM tem) e `is_echo !== true` (exclui resposta da IA).
- Qualquer outro evento (reactions, handover, echo, etc.) não atende e fica barrado.

Se o n8n não aceitar condição do tipo “Expression” com esse texto, use a opção **4.3** abaixo (duas condições OR).

---

## 5. Configuração no n8n (condições separadas)

### 5.1. Filtro (um único nó Filter)

Objetivo: **só passar eventos úteis** (comentários + mensagens de usuário no Direct, sem echo). Tudo que não for isso fica barrado.

- **Combinador geral:** **AND** entre os grupos abaixo.
- No n8n o body costuma vir em `$json.body`; se no seu caso for só `$json`, troque `$json.body` por `$json`.

**Grupo 1 – Só Instagram**

| Left | Operador | Right |
|------|----------|--------|
| `{{ $json.body.object }}` | equals | `instagram` |

**Grupo 2 – Só comentários ou mensagens (OR entre as 3)**

| # | Left | Operador | Right |
|---|------|----------|--------|
| 1 | `{{ $json.body.entry[0].changes[0].field }}` | equals | `comments` |
| 2 | `{{ $json.body.entry[0].changes[0].field }}` | equals | `live_comments` |
| 3 | `{{ $json.body.entry[0].changes[0].field }}` | equals | `messages` |

**Grupo 3 – Para `messages`, excluir echo (OR)**

| # | Left | Operador | Right |
|---|------|----------|--------|
| A | `{{ $json.body.entry[0].changes[0].field }}` | not equals | `messages` |
| B | `{{ $json.body.entry[0].changes[0].value.message?.is_echo }}` | not equals | `true` |

Se não puder usar `?.`, use uma única condição:

- Left: `{{ $json.body.entry[0].changes[0].field === 'messages' ? ($json.body.entry[0].changes[0].value.message || {}).is_echo : false }}`
- Operador: **not equals**
- Right: `true`

Assim o filtro **só deixa passar** o que é útil e **evita passar** echo, reactions, handover, etc.

**Alternativa em 2 condições (OR), usando MID no Direct:** se preferir não usar uma expressão única, use **OR** entre:
- **Condição A:** `{{ $json.body.entry[0].changes[0].field }}` **equals** `comments` OU **equals** `live_comments` (duas linhas ou uma com “in” se existir).
- **Condição B (Direct com mid e sem echo):**  
  `{{ $json.body.entry[0].messaging && $json.body.entry[0].messaging[0].message.mid && $json.body.entry[0].messaging[0].message.is_echo !== true }}` **equals** `true`.  
  Assim você usa o **MID** para identificar Direct e ao mesmo tempo exclui echo.

---

### 5.2. Depois do filtro: 2 rotas (Agente Comentários | Agente Direct)

Quem passar pelo filtro será **só**:
- `comments` ou `live_comments` → devem ir para o **Agente de Comentários**
- `messages` (já sem echo) → devem ir para o **Agente de Direct**

**Opção A – Nó Switch (recomendado)**

- **Rule 1 (Comentários):**  
  `{{ $json.body.entry[0].changes[0].field === 'comments' || $json.body.entry[0].changes[0].field === 'live_comments' }}`  
  → saída “comentários” → conecta ao **Agente de Comentários**.
- **Rule 2 (Direct):**  
  `{{ $json.body.entry[0].changes[0].field === 'messages' }}`  
  → saída “direct” → conecta ao **Agente de Direct**.

**Opção B – Dois nós IF**

- **IF 1:** `field` equals `comments` OR `field` equals `live_comments` → **true** = Agente de Comentários.
- **IF 2:** `field` equals `messages` → **true** = Agente de Direct.

**Opção C – Dois Filtros em paralelo**

- Filtro “Só comentários”: `field` equals `comments` OR `live_comments` → segue para Agente de Comentários.
- Filtro “Só direct”: `field` equals `messages` → segue para Agente de Direct.

---

## 6. Fluxo resumido

```
Webhook (POST Instagram)
        ↓
   [ FILTRO ]
   Só passa: object=instagram + (comments | live_comments | messages sem echo)
   Barra: echo, message_reactions, handover, mentions, story_insights, etc.
        ↓
   [ SWITCH ou IF / 2 rotas ]
        ├── field in (comments, live_comments) → Agente de Comentários
        └── field === messages                 → Agente de Direct
```

---

## 6. Sobre “reaction” e o coração

- **Reaction (message_reactions):** é quando alguém clica no **coração** (ou outro emoji) **na mensagem do Direct**. O webhook envia `field: "message_reactions"`. Não é like no post do feed.
- Se ao clicar no coração “não acontece nada” no seu fluxo, é porque:
  - ou o filtro está barrando `message_reactions` (e você **não** quer processar isso), ou
  - a assinatura do app não está inscrita em `message_reactions`, ou
  - o evento não está chegando no seu endpoint.
- Para o seu uso (responder a **comentários** e **mensagens de texto no Direct**), não precisamos de `message_reactions`; manter barrado no filtro está correto.

Você se expressou bem: o filtro existe para **evitar passar para a próxima etapa** exatamente as respostas do webhook que **não são úteis**; depois disso, as **duas rotas** separam Agente de Comentários e Agente de Direct.
