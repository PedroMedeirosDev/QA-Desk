# Colocar a QA App no ar

## Opção 1 — Sua máquina (recomendado para homologação + Maestro)

Maestro e emulador **só rodam no seu PC**. Para homologação do Mural com execução em um clique, use produção local:

```powershell
cd qa-app
copy .env.example .env
# Edite .env: QA_AUTOMATION_RUN=1

npm install
npm run start:prod
```

Abre em **http://localhost:3001** (UI + API no mesmo endereço).

Na **mesma rede Wi‑Fi** (outro notebook/celular): descubra seu IP (`ipconfig`) e acesse `http://192.168.x.x:3001`.

### Homologação Mural

1. Abra **Polygonus** no app
2. Clique **Criar checklist Mural** (5 itens com Maestro vinculado)
3. Abra cada item → **Executar automação** (emulador Android ligado, `adb devices` ok)
4. Anexe print se falhar → status **Reportado**; se passar → **Homologado**

---

## Opção 2 — Túnel rápido (acesso de fora da rede)

Se precisar acessar de outro lugar sem deploy:

```powershell
# Com a app rodando em :3001
npx ngrok http 3001
```

Use a URL HTTPS do ngrok. **Dados ficam no seu PC** — não desligue a máquina.

---

## Opção 3 — Deploy cloud (só registro, sem Maestro)

Render / Railway / Fly.io com volume persistente para `qa-app/data/`.

- **Funciona:** registrar bugs, prints, histórico, checklist
- **Não funciona:** executar Maestro (não há emulador no servidor)

Nesse caso deixe `QA_AUTOMATION_RUN` desligado; use a app só como catálogo e rode Maestro no terminal.

---

## Variáveis

| Variável | Uso |
|----------|-----|
| `QA_APP_PORT` | Porta (padrão 3001) |
| `QA_APP_HOST` | `0.0.0.0` = rede local |
| `NODE_ENV=production` | Serve build React + API |
| `QA_AUTOMATION_RUN=1` | Habilita execução Maestro local |

---

## Limitação importante

**Um clique no navegador** dispara o Maestro **na máquina onde a API roda** — não no celular do usuário remoto. Para sua homologação (você + emulador), isso é o ideal.
