# Coordenadas Mural — guia rápido

Os subflows usam **`tapOn: point`** via variáveis no `flows/.env`.  
Template: [`coordenadas.env.example`](coordenadas.env.example)

## Como passar para o Cursor

Cole no chat neste formato (emulador **Medium_Phone**, Mural aberto):

```
COORD_FILTRO_RECEBIDAS=?, ?
COORD_FILTRO_ENVIADOS=?, ?
COORD_FILTRO_PENDENTES=?, ?
COORD_MENU_TRES_PONTOS=?, ?
COORD_BOOM_FAB=?, ?
COORD_BOOM_AVISO=?, ?
COORD_BOOM_EVENTO=?, ?
COORD_BOTAO_GALERIA=?, ?
COORD_BOTAO_ENQUETE=?, ?
COORD_BOTAO_ANEXO=?, ?
```

## Onde cada uma entra

| Variável | Tela | CTs |
|----------|------|-----|
| `COORD_FILTRO_ENVIADOS` | Chip abaixo do nome | 02 editar, 03 excluir, 09 filtro |
| `COORD_FILTRO_PENDENTES` | Chip abaixo do nome | CT legado professor (removido) |
| `COORD_MENU_TRES_PONTOS` | ⋮ do card (com texto visível) | 02, 03, 05 foto |
| `COORD_BOOM_FAB` | FAB flutuante | 01, 04–08 |
| `COORD_BOOM_AVISO` | Item Aviso no menu radial | 01, 04–07 |
| `COORD_BOOM_EVENTO` | Item Evento no menu radial | 08 evento |
| `COORD_BOTAO_GALERIA` | Ícone galeria no composer | 05, 07 |
| `COORD_BOTAO_ENQUETE` | Ícone enquete no composer | 04 |
| `COORD_BOTAO_ANEXO` | Clip PDF no composer | 06 |

Textos estáveis (`Editar`, `Excluir`, `Enviar comunicado`, login) **permanecem por texto** — só UI sem accessibility usa coordenada.

## Teste rápido de uma coord

```powershell
cd projects\polygonus\automation\maestro
maestro.bat test -e COORD="72%, 20%" flows/shared/mural/tap_coordenada.yaml
```
