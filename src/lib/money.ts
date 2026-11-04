/**
 * Dinheiro no PERSONTASK.
 *
 * A moeda é do **Espaço** (`spaces.currency`, ISO 4217) e vale para tudo que
 * é valor: Custo e Custo/hora do cronograma e os campos personalizados
 * marcados como moeda. A formatação sai no padrão do idioma — em pt-BR,
 * `41150` vira `R$ 41.150,00`.
 */

/** Moedas oferecidas na configuração do Espaço. */
export const CURRENCIES = [
  'BRL',
  'USD',
  'EUR',
  'GBP',
  'ARS',
  'CLP',
  'COP',
  'MXN',
  'PYG',
  'UYU',
  'JPY',
  'CHF',
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY = 'BRL';

/** Símbolo curto da moeda, para rótulos (`R$`, `US$`, `€`…). */
export function currencySymbol(currency = DEFAULT_CURRENCY, locale = 'pt-BR'): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

/**
 * Valor formatado com moeda: `R$ 41.150,00`, `US$ 1.200,50`, `€ 980,00`.
 * Devolve `fallback` quando não há valor (nulo, vazio ou não numérico).
 */
export function formatMoney(
  value: number | string | null | undefined,
  currency = DEFAULT_CURRENCY,
  locale = 'pt-BR',
  fallback = '—',
): string {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n)) return fallback;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    // Moeda desconhecida: ao menos sai com os milhares separados.
    return `${currency} ${n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

/**
 * Versão curta para eixos de gráfico: `41,2 mil` · `1,3 mi`. Sem símbolo,
 * que o rótulo do eixo já diz a moeda.
 */
export function formatCompact(value: number, locale = 'pt-BR'): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `${(value / 1_000).toLocaleString(locale, { maximumFractionDigits: 1 })} mil`;
  return value.toLocaleString(locale, { maximumFractionDigits: 0 });
}

/** Número com separador de milhar e 2 casas, sem moeda: `41.150,00`. */
export function formatNumber(
  value: number | null | undefined,
  locale = 'pt-BR',
  fallback = '—',
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  return value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
