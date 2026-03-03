# Regras de trabalho – FabriaIA Agente Instagram

## Fluxo de código e deploy

1. **Repositório:** o código vive no GitHub; toda codificação é commitada e enviada (push) para esse repositório.
2. **Deploy:** implantação feita por você no EasyPanel:
   - App conectado ao repositório GitHub.
   - Build via Dockerfile (e branch configurada).
   - Serviços (painel, APIs futuras) instalados e configurados no EasyPanel.
3. **Organização:** manter estrutura consistente (painel/, api/, docs/, Docker na raiz) para facilitar build e manutenção.

## Convenções

- **Commits:** mensagens objetivas (ex.: "feat: tela de postagens", "fix: filtro webhook").
- **Branch principal:** `main` (ou a que estiver configurada no EasyPanel para build).
- **Ambiente:** variáveis sensíveis (tokens, DB) apenas em ambiente / EasyPanel, nunca commitadas.
