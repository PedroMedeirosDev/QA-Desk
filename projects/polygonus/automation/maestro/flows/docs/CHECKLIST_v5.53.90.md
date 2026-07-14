# Checklist homologação app — v5.53.90

**OS:** Android · **Build:** 5.53.90 · **Perfil principal:** PHJESUS (coordenador/professor)  
**Verificação responsável:** ETMENEZES · **Turmas:** Rotina → `Maternal II` · Conteúdo/notas/tarefas → `M3A2026` · 4º ano → `4A` (ver `testes/homologacao/turmas-homologacao.md`)

Legenda automação: ✅ Maestro · 🟡 parcial · 📱 manual · ⬜ falta flow

| #           | Item                                                              | Auto | Flow / nota                                                       |
| ----------- | ----------------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| **1.1**     | Comunicado (enviar, editar, excluir, enquete, foto)               | 🟡   | `mural/01_1_*.yaml` — **draft** (porto seguro OK; taps Studio)   |
| **1.1**     | Vídeo câmera, vídeo G, compartilhar/salvar anexo (ajuste fino)    | 📱   | `mural/01_1_CHECKLIST_MANUAL.md`                                  |
| **1.2.1**   | Rotina Banheiro / Alimentação / Soneca                            | 🟡   | `rotina/01_2_1_rotina_*.yaml` — termos variam por entidade        |
| **1.2.2**   | Ocorrência (enviar, editar, excluir, responder)                   | 🟡   | `rotina/01_2_2_ocorrencia_enviar.yaml` + manual editar/excluir    |
| **1.2.3**   | Momentos (15 fotos, editar, excluir)                              | 🟡   | `rotina/01_2_3_momentos_enviar.yaml` — fotos = manual/galeria     |
| **1.2.4**   | Bilhetes                                                          | 🟡   | `rotina/01_2_4_bilhete_enviar.yaml`                               |
| **1.3.1**   | Diário / calendário (professor)                                   | ⬜   | último da sequência — `diario/`                                   |
| **2.1–2.2** | Notas / conceitos História + Geografia                            | 📱   | fluxo complexo — `notas/` backlog                                 |
| **3.1–3.3** | Conteúdo e frequência                                             | 🟡   | `conteudo/03_1_*.yaml`                                            |
| **4.1**     | Tarefas (não fez)                                                 | ⬜   | `tarefas/` backlog                                                |
| **5.1**     | Mensalidades / boleto                                             | ⬜   | `financeiro/` backlog                                             |
| **6.1–6.2** | Fale Conosco (texto, áudio, vídeo, pdf)                           | 🟡   | `atendimento/06_1_*.yaml` — módulo `/atendimento` (não Chat novo) |

## Ordem sugerida de implementação

1. Rotina 1.2.x (subflows prontos)
2. Conteúdo e frequência (3.x)
3. Fale Conosco (6.x)
4. Notas / Tarefas / Boletos / Diário

## Rodar suíte mural + rotina

```bash
cd testes/automation/maestro/flows
maestro test mural/
maestro test rotina/
```

Credenciais: copie `.env.example` → `.env` na pasta `flows/`.
