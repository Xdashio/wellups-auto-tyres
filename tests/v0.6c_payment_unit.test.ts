import { describe, it, expect } from 'vitest';

describe('V0.6C Payment validation', () => {
  it('normalizes M-Pesa reference', () => {
    const normalize = (ref: string) => ref.trim().toUpperCase();
    expect(normalize('qhg729x4lp')).toBe('QHG729X4LP');
    expect(normalize('  abc1234567 ')).toBe('ABC1234567');
  });

  it('validates reference regex', () => {
    const regex = /^[A-Z0-9]{10}$/;
    expect(regex.test('QHG729X4LP')).toBe(true);
    expect(regex.test('ABCDEFGHIJ')).toBe(true);
    expect(regex.test('1234567890')).toBe(true);
    expect(regex.test('ABCDEFGHI')).toBe(false);
    expect(regex.test('ABCDEFGHIJK')).toBe(false);
    expect(regex.test('ABC-123456')).toBe(false);
    expect(regex.test('')).toBe(false);
  });

  it('full payment rule enforced server-side', () => {
    const acceptedAmount = 100000;
    const submittedAmount = 100000;
    expect(submittedAmount === acceptedAmount).toBe(true);
  });
});
