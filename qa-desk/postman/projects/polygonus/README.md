# Polygonus — suite API (amostra CQ)

Collection Newman para homologar a **Ficha Acadêmica** (e evoluir).

Gestão CQ: `https://amostra.polygonus.com.br:8443/web/react/gestao/login`  
Host CQ: até `:8443` (remove o path `/web/react/...`)  
API: `https://amostra.polygonus.com.br:8443/api/v2`

## Fluxo

1. Corporação por hostname  
2. Login `SUPPETER` (`POST /auth/token`)  
3. Entidades → unidade **Colégio Demonstração**  
4. Perfis → primeiro perfil  
5. `POST /auth/entidade`  
6. `GET /academico/aluno/contexto` (shape da ficha)

## Credenciais

Só via env / environment local — ver [postman/README.md](../../README.md).
