# Homologação Polygonus — inventário (APP + WEB app)

Atualizado: 2026-08-09.

## Missão (fechada)

Homologar **tudo** em **APP + WEB** (Comunicação → Comunicados = mesmo app), como **regressão** (release / coisa nova → nada quebrou).

| Dimensão | Escopo |
|----------|--------|
| Superfícies | APP (Maestro) + WEB app (Playwright) |
| Perfis | **Coordenador**, **Responsável**, **Professor** (lançamentos) |
| Tipo | Regressão: smoke + críticos; menus **mudam de comportamento por perfil** |
| Fora | **Aula Online** (Responsável), **Chegando** (ambos, se aparecer) |

---

## Regra de ouro

O **mesmo tile** pode ser fluxo diferente conforme o perfil (ex.: Mural = envio/gestão no Coordenador vs consumo no Responsável; Notas = lançamento no Professor/Coordenador vs consulta no Responsável).

→ Inventário e CTs devem ser **menu × perfil**, não só “nome do menu”.

---

## Perfis

| Perfil | Papel na regressão |
|--------|-------------------|
| **Responsável** | Consumo / consulta (boletim, mensalidade, mural recebidas, etc.) |
| **Coordenador** | Gestão escolar + Mural envio + vários tiles operacionais |
| **Professor** | **Lançamento** de **notas**, **conteúdo** (e frequência) e **tarefas** |

---

## Home — **Responsável** (print)

### In scope (14)

| # | Menu | Nota |
|---|------|------|
| 1 | Mural | Consumo (Recebidas) — gap vs CTs atuais de envio |
| 2 | Calendário | |
| 3 | Boletim Online | Consulta |
| 4 | Notas Parciais | Consulta |
| 5 | Mensalidade | |
| 6 | Conteúdo Lecionado | Consulta (≠ lançamento Professor) |
| 7 | Frequência do Aluno | Consulta |
| 8 | Meus Documentos | |
| 9 | Horário | |
| 10 | Atendimento | |
| 11 | Tarefas para Casa | Consulta (≠ lançamento Professor) |
| 12 | Avaliação do Conhecimento | `BUG-2026-002` truncamento |
| 13 | Avaliação de Habilidades | |
| 14 | Notas Fiscais | |

### Fora

- Aula Online  
- Chegando  

---

## Home — **Coordenador** (print · Pedro Jesus)

### In scope

| # | Menu | Nota / automação |
|---|------|------------------|
| 1 | **Mural** | Envio — 24 CTs Maestro (mais denso). Badge notificação (ex. 47). |
| 2 | **Calendário** | |
| 3 | **Notas** | Lançamento / gestão de notas (azul). Relaciona Professor. |
| 4 | **Conteúdo e Frequência** | Lançamento conteúdo/frequência. Relaciona Professor. |
| 5 | **Tarefas** | Lançamento de tarefas. Relaciona Professor. |
| 6 | **Ocorrências** | |
| 7 | **Meus Alunos** | |
| 8 | **Atendimento** | Badge (ex. 4) — **versão nova** (legado removido do perfil; antes apareciam 2 tiles) |
| 9 | **Cardápio** | |

~~Segundo tile Atendimento~~ — era **legado** ao lado da versão nova; perfil já limpo (só um).

### Fora

- **Chegando**

---

## Home — **Professor** (print · Pedro Jesus)

### In scope

| # | Menu | Nota |
|---|------|------|
| 1 | **Mural** | Badge (ex. 47) — perfil Professor (comportamento próprio vs Coordenador/Responsável) |
| 2 | **Calendário** | |
| 3 | **Notas** | **Lançamento de notas** (crítico Professor) |
| 4 | **Conteúdo e Frequência** | **Lançamento de conteúdo / frequência** (crítico) |
| 5 | **Tarefas** | **Lançamento de tarefas** (crítico) |
| 6 | **Ocorrências** | |
| 7 | **Meus Alunos** | |
| 8 | **Atendimento** | Badge (ex. 25) — um tile (diferente do Coordenador com 2×) |
| 9 | **Cardápio** | |

### Fora

- **Aula Online**
- **Chegando**

Grade bem próxima da do Coordenador (sem o segundo Atendimento). Críticos de regressão Professor = **Notas + Conteúdo e Frequência + Tarefas** (lançamento).

---

## Estratégia de regressão

1. **Smoke menu × perfil** (abrir → carrega → voltar) — APP, depois WEB.  
2. **Críticos por perfil:**  
   - Coordenador: subset Mural envio (CRUD + 1 anexo + 1 filtro).  
   - Responsável: Mural consumo + smokes dos 14.  
   - Professor: smoke + 1 fluxo mínimo de lançamento (notas, conteúdo, tarefas).  
3. Onde o comportamento diverge por perfil, **não** reutilizar o mesmo assert cego.  
4. Bugs no Desk (ex. truncamento, Atendimento duplicado se for o caso).

---

## Automação hoje (resumo)

| Área | Estado |
|------|--------|
| Mural Coordenador (envio) | 24 flows Maestro; maturidade/`consolidated` frágil |
| Mural Responsável (consumo) | Gap |
| Demais menus × 3 perfis | Smokes Maestro OK (`flows/smoke/regressao_menus_*.yaml`) — CTs densos ainda gap |
| Playwright app web | Smoke abertura OK (`mural/smoke-comunicados-web.spec.ts`): gestão → Comunicados → iframe Flutter. **Menus/taps bloqueados** — CanvasKit sem árvore a11y |
| Discord bugs (Desk) | Bot + reações 🔧/✅/⏸️/❌ + 💯 QA — falta `DISCORD_BUG_CHANNEL_ID` no env local até ter admin no servidor |
| Professor lançamentos | Zero |

---

## Checklist

- [x] Print home Responsável / Coordenador / Professor
- [x] Atendimento Coordenador: era novo+legado; legado removido do perfil (só um) · id `home_card_chat`
- [x] Smoke Responsável × 14 (APP) — `regressao_menus_responsavel.yaml` OK (2026-08-09)
- [x] Smoke Coordenador × menus in-scope (APP) — OK
- [x] Smoke Professor × menus in-scope (APP) — OK (lançamento mínimo ainda pendente)
- [x] Espelho WEB (Playwright) — abertura Comunicados OK; taps home pendem semantics web
- [ ] Subset Mural Maestro Coordenador
- [x] Bugs Desk + Discord (bot/reações) — canal Discord pendente no env
- [ ] Professor: fluxos mínimos de lançamento (notas / conteúdo / tarefas)

---

## Semantics / a11y (pedido aos desenvolvedores)

Lista canônica + ids sugeridos + **bloco copiar/colar**: [`automation/maestro/flows/docs/SEMANTICS_SUGESTOES.md`](automation/maestro/flows/docs/SEMANTICS_SUGESTOES.md).

Resumo: home `home_card_*` mapeados no tip `2125500d` (v6.06.14) — smokes `regressao_menus_*.yaml` usam `CARD_ID`. Cardápio custom ainda pode ser slug/`texto`.

**WEB:** revalidar a11y no iframe após `ensureSemantics()`; espelho Playwright ainda pendente de prova na amostra.

---

## Próximo passo de implementação

1. ~~Helpers login + smoke R/C/P.~~ OK no emulador.  
2. ~~Piloto Playwright app web (entrar Comunicados).~~ Abertura OK; a11y/taps pendentes.  
3. Professor: fluxos mínimos de lançamento (notas / conteúdo / tarefas).  
4. **Mapear semantics faltantes** (APP + WEB) → texto pronto para enviar aos desenvolvedores.  
5. Subset Mural Maestro Coordenador.
