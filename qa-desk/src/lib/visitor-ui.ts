/** Classes de campo somente-leitura no modo visitante (imutável no DOM). */
export const visitorReadonlyFieldClass =
  "bg-transparent border-transparent cursor-default focus:ring-0 focus-visible:ring-0 text-[var(--muted-foreground)] opacity-90";

/** Props comuns para inputs/textareas/selects no portfólio visitante. */
export const visitorReadonlyInputProps = {
  readOnly: true as const,
  disabled: true as const,
  className: visitorReadonlyFieldClass,
};
