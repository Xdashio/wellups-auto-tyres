/** Current product margin semantics: sell_price - cost_price, to 2dp. */
export function calcMargin(costPrice: number, sellPrice: number): number {
  return Math.round((sellPrice - costPrice) * 100) / 100;
}
