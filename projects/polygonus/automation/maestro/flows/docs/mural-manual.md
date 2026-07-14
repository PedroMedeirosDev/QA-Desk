# 1.1 Comunicado — Itens que ficam como teste MANUAL

Estes itens do checklist original **não são automatizados** nesta versão dos flows.
Execute-os manualmente e registre evidência (screenshot / anotação).

## Gravação de vídeo pela câmera

**Por quê manual:** UI nativa gravar/parar/confirmar.

---

## Foto / vídeo pequeno (MP4) — AUTOMATIZÁVEL

Use `addMedia` + flow `01_1_comunicado_foto_galeria.yaml` / `01_1_comunicado_video_pequeno.yaml`.  
Ver `testes/automation/maestro/fixtures/README.md`.

---

## Anexar vídeo médio e grande

**Por quê manual:** uploads longos podem exceder o timeout do Maestro; além disso,
é necessário ter arquivos de tamanhos específicos no device para reproduzir o teste.

**Como testar:**
- Pequeno: até ~10 MB
- Médio: ~30–50 MB
- Grande: ~100 MB+

Use o ícone de anexo → "Selecionar arquivo" e escolha os vídeos pré-carregados no device.
Registre o tempo de upload e se o envio completou sem erro.

---

## Anexar arquivo genérico (PDF, DOC, etc.) — AUTOMATIZÁVEL

Flow: `01_1_comunicado_pdf.yaml` + `FIXTURE_PDF` no `.env` (nome exato do arquivo).

1. Coloque o PDF em `fixtures/`
2. `.\scripts\push-maestro-fixtures.ps1`
3. `maestro test mural/01_1_comunicado_pdf.yaml`

**Frágil:** seletor DocumentsUI muda entre versões Android — ajuste no Maestro Studio se falhar.

---

## Evidência sugerida

- Screenshot do comunicado com vídeo/arquivo anexado na lista
- Screenshot do player de vídeo aberto
- Screenshot do share sheet ao compartilhar
