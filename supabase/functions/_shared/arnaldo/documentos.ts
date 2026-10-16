// Apoio ao dados_documento: empresa, configuração (com padrões), legendas de foto e telefone formatado.
import { normalizeBrPhone } from "./phone.ts";

export const TIPOS_DOCUMENTO = ["orcamento", "ficha_entrada", "os_patio", "recibo"] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const EMPRESA = {
  nome: "MD Mecânica Multimarcas",
  cnpj: "05.887.728/0001-09",
  telefone: "(47) 8488-9108",
  endereco: "Rua 248, 721 · Meia Praia · Itapema/SC · 88220-000",
  email: "mdmultimarcas123@hotmail.com",
};

export interface ConfigDocumentos {
  validade_orcamento_dias: number;
  garantia_dias: number;
  formas_pagamento: string;
  texto_aprovacao: string;
  texto_ficha: string;
  texto_garantia: string;
}

// Textos copiados dos modelos aprovados (docs/superpowers/specs/documentos-md/*.mockup.html)
export const CONFIG_PADRAO: ConfigDocumentos = {
  validade_orcamento_dias: 7,
  garantia_dias: 90,
  formas_pagamento: "PIX, cartão ou dinheiro",
  texto_aprovacao:
    "A aprovação (assinada, pelo link ou pelo WhatsApp) autoriza a execução dos serviços acima. Peças e serviços fora deste orçamento são comunicados antes e dependem de nova aprovação. Valores válidos até a data de validade.",
  texto_ficha:
    'O cliente confere que o veículo foi entregue nas condições acima. A MD não se responsabiliza por objetos não listados em "Pertences".',
  texto_garantia:
    "A garantia cobre defeito das peças e do serviço listados. Não cobre mau uso, acidente ou serviço feito por terceiros no mesmo item.",
};

/** Mescla `tenants.settings.documentos` com os padrões: só chaves conhecidas, com o tipo certo. */
export function configDocumentos(settings: unknown): ConfigDocumentos {
  const cfg: ConfigDocumentos = { ...CONFIG_PADRAO };
  const doc = settings && typeof settings === "object" ? (settings as Record<string, unknown>).documentos : null;
  if (!doc || typeof doc !== "object") return cfg;
  const o = doc as Record<string, unknown>;
  for (const k of ["validade_orcamento_dias", "garantia_dias"] as const) {
    if (typeof o[k] === "number" && Number.isInteger(o[k]) && (o[k] as number) >= 0) cfg[k] = o[k] as number;
  }
  for (const k of ["formas_pagamento", "texto_aprovacao", "texto_ficha", "texto_garantia"] as const) {
    if (typeof o[k] === "string" && (o[k] as string).trim()) cfg[k] = (o[k] as string).trim();
  }
  return cfg;
}

/** 5547984889108 → (47) 98488-9108. Se não der para normalizar, devolve o texto original. */
export function foneFormatado(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const canon = normalizeBrPhone(String(raw));
  if (!canon) return String(raw);
  const d = canon.slice(2), ddd = d.slice(0, 2), resto = d.slice(2);
  return resto.length === 9 ? `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}` : `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
}

const POSICOES: Record<string, string> = { front: "Frente", back: "Traseira", left: "Lateral esq.", right: "Lateral dir." };

/**
 * Legenda da foto, a partir de `attachments.file_name` (a tabela não tem coluna de legenda):
 * - app (CheckinDialog): `checkin-front.jpg` → Frente;
 * - Arnaldo (anexar_foto): `<tipo>__<legenda>__<timestamp>.<ext>`.
 */
export function legendaDaFoto(fileName: unknown): string | null {
  if (typeof fileName !== "string") return null;
  const stem = fileName.replace(/\.[a-z0-9]+$/i, "");
  const partes = stem.split("__");
  if (partes.length === 3 && partes[1].trim()) return partes[1].trim();
  const m = /^checkin-(front|back|left|right)$/i.exec(stem);
  return m ? POSICOES[m[1].toLowerCase()] : null;
}

/** O app ainda não marca avaria: vale a palavra "avaria" na legenda ou no nome do arquivo (TODO no relatório). */
export const ehAvaria = (legenda: string | null, fileName: unknown) => /avaria/i.test(legenda ?? String(fileName ?? ""));
