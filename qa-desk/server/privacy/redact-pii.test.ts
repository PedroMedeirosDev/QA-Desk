import assert from "node:assert/strict";
import { redactPii, redactPiiDeep } from "../privacy/redact-pii.js";

function check(label: string, input: string, expected: string) {
  const got = redactPii(input);
  assert.equal(got, expected, `${label}\n  in:  ${input}\n  out: ${got}\n  exp: ${expected}`);
  console.log(`ok  ${label}`);
}

check("cpf formatted", "Aluno CPF 529.982.247-25 ok", "Aluno CPF [CPF] ok");
check("cpf digits", "cpf 52998224725 fim", "cpf [CPF] fim");
check("cnpj formatted", "CNPJ 11.222.333/0001-81", "CNPJ [CNPJ]");
check("email", "contato jose@escola.com.br amanhã", "contato [EMAIL] amanhã");
check("phone", "ligar (11) 98765-4321 agora", "ligar [TELEFONE] agora");
check("clean", "suite CRUD-01 passou", "suite CRUD-01 passou");
check(
  "link do discord intacto",
  "ver https://discord.com/channels/1339775689209024612/1524389844153925662/1563189405949100093 e ligar (11) 98765-4321",
  "ver https://discord.com/channels/1339775689209024612/1524389844153925662/1563189405949100093 e ligar [TELEFONE]",
);
check("cpf fora do link", "CPF 529.982.247-25 em https://x.com/a?b=1", "CPF [CPF] em https://x.com/a?b=1");

const deep = redactPiiDeep({
  a: "CPF 529.982.247-25",
  b: ["x", "mail test@x.com"],
  c: { nested: "11.222.333/0001-81" },
});
assert.deepEqual(deep, {
  a: "CPF [CPF]",
  b: ["x", "mail [EMAIL]"],
  c: { nested: "[CNPJ]" },
});
console.log("ok  deep");

{
  const kept = redactPiiDeep({
    testLogin: "64594815200",
    description: "Login 64594815200 na unidade",
    title: "CPF 529.982.247-25",
  });
  assert.equal(kept.testLogin, "64594815200");
  assert.equal(kept.description, "Login 64594815200 na unidade");
  assert.equal(kept.title, "CPF [CPF]");
  console.log("ok  skip testLogin e description");
}

console.log("all redact-pii tests passed");
