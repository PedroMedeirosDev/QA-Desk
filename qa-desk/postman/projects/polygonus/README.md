# Polygonus — suite API (amostra)

Collection Newman para homologar a **Ficha Acadêmica** (e evoluir).

## Fluxo

1. Corporação por hostname  
2. Login `SUPPETER` (`POST /auth/token`)  
3. Entidades → unidade **Colégio Demonstração**  
4. Perfis → primeiro perfil  
5. `POST /auth/entidade`  
6. `GET /academico/aluno/contexto` (shape da ficha)

## Credenciais

Só via env / environment local — ver [postman/README.md](../../README.md).
