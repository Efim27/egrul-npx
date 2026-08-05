import { randomUUID, webcrypto } from 'node:crypto';

interface CryptoWithOptionalRandomUuid {
  randomUUID?: () => string;
}

export function ensureGlobalCrypto(): void {
  const globalObject = globalThis as typeof globalThis & {
    crypto?: CryptoWithOptionalRandomUuid;
  };
  const cryptoObject =
    globalObject.crypto ??
    (webcrypto as unknown as CryptoWithOptionalRandomUuid);

  if (typeof cryptoObject.randomUUID !== 'function') {
    Object.defineProperty(cryptoObject, 'randomUUID', {
      value: randomUUID,
      configurable: true,
      enumerable: false,
      writable: false,
    });
  }

  if (!globalObject.crypto) {
    Object.defineProperty(globalObject, 'crypto', {
      value: cryptoObject,
      configurable: true,
      enumerable: false,
      writable: false,
    });
  }
}
