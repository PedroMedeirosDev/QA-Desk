# Polygonus — Auth & sessão (gestão)

Suite Newman na amostra CQ. Por enquanto ainda carrega o `GET /academico/aluno/contexto` até a collection **Ficha** ser separada.

Gestão CQ: `https://amostra.polygonus.com.br:8443/web/react/gestao/login`  
API: `https://amostra.polygonus.com.br:8443/api/v2`

## Fluxo

1. Corporação por hostname  
2. Login `SUPPETER` (`POST /auth/token`)  
3. Entidades → unidade **Colégio Demonstração**  
4. Perfis → primeiro perfil  
5. `POST /auth/entidade`  
6. `GET /academico/aluno/contexto` (vai para polygonus-ficha depois)

## Credenciais

Só via env / environment local — ver [postman/README.md](../../README.md).
