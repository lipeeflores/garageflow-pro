import { normalizeBrPhone } from "../phone.ts";
import {
  CLIENTE_E_EQUIPE, ErroArnaldo, clientePorTelefone, exigirPlaca, inteiro, invalido, ok, placaNorm, texto, veiculoPorPlaca, type Acao,
} from "../util.ts";

const acao: Acao = {
  papeis: CLIENTE_E_EQUIPE,
  async run(args, ctx) {
    const nome = texto(args, "nome", { max: 120 })!;
    const placa = exigirPlaca(args.placa);
    const marca = texto(args, "marca", { max: 60 })!;
    const modelo = texto(args, "modelo", { max: 80 })!;
    const ano = inteiro(args, "ano", { obrig: false, min: 1950, max: 2100 });
    const cor = texto(args, "cor", { obrig: false, max: 40 });

    // Cliente: o telefone é SEMPRE o de quem está falando (ignora `telefone`). Equipe informa o do cliente.
    const canon = ctx.papel === "cliente"
      ? normalizeBrPhone(ctx.telefone)
      : normalizeBrPhone(texto(args, "telefone", { obrig: false }));
    if (!canon) {
      throw invalido(
        ctx.papel === "cliente"
          ? "Não consegui identificar o telefone deste atendimento."
          : 'Falta o telefone do cliente ("telefone").',
      );
    }

    const veiculoExistente = await veiculoPorPlaca(ctx, placa);
    let cliente = await clientePorTelefone(ctx, canon);
    if (veiculoExistente && (!cliente || veiculoExistente.customer_id !== cliente.id)) {
      throw new ErroArnaldo(
        "conflito",
        "Essa placa já está cadastrada em outro cliente. Não alterei nada; a equipe da oficina precisa conferir.",
      );
    }

    let criado = false;
    if (!cliente) {
      cliente = ok(
        await ctx.db.from("customers")
          .insert({ tenant_id: ctx.tenantId, full_name: nome, phone_number: canon.slice(2) }).select().single(),
        "customers",
      );
      criado = true;
    }
    let veiculo = veiculoExistente;
    if (!veiculo) {
      veiculo = ok(
        await ctx.db.from("vehicles").insert({
          tenant_id: ctx.tenantId, customer_id: cliente.id, plate: placaNorm(placa), make: marca, model: modelo,
          year: ano ?? null, color: cor ?? null,
        }).select().single(),
        "vehicles",
      );
      criado = true;
    }
    return { cliente_id: cliente.id, veiculo_id: veiculo.id, criado };
  },
};
export default acao;
