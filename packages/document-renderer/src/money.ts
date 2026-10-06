/** Half-up integer cents. Authoritative money never uses binary floating point. */
export function roundHalfUpBps(amountCents: number, bps: number): number {
  if (!Number.isSafeInteger(amountCents) || !Number.isSafeInteger(bps)) {
    throw new Error('invalid_money');
  }
  if (amountCents < 0 || bps < 0) throw new Error('invalid_money');
  return Number((BigInt(amountCents) * BigInt(bps) + 5000n) / 10000n);
}

export function assertSafeCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) throw new Error(`invalid_${label}`);
}
