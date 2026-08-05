/** @deprecated Use buildAlunoDemo / buildAlunoCompleto de ./massa */
export { buildAlunoDemo, buildAlunoCompleto, type AlunoCompleto } from "./massa";

export type AlunoDemoFixture = {
  nome: string;
  dataNascimento: string;
  cpf: string;
  email: string;
  telefone: string;
};
