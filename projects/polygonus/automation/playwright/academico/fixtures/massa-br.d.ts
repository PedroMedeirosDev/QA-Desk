declare module "massa-br" {
  export function createGenerator(seed: string): {
    seed: string;
    cpf: (opts?: { mask?: boolean }) => string;
    cnpj: (opts?: { mask?: boolean; tipo?: string }) => string;
    celular: (uf?: string) => string;
    cep: (uf?: string) => string;
    nome: () => string;
    email: () => string;
    pessoa: (opts?: { mask?: boolean }) => {
      nome: string;
      cpf: string;
      email: string;
      celular: string;
      nascimento: string;
      endereco?: { cep: string; uf: string; cidade: string };
    };
  };
}
