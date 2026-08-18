import {
  API_ADDR,
  REQUEST_TIMEOUT_MS,
  readLicenseKey,
  validateApiAddress,
} from './config.js';

const OBJECT_CODE = 'DICTIONARY_CORR_EGRUL';
const DOC_CODE = 'DICTIONARY_CORR';
const OBJECT_PARAMETERS = JSON.stringify({
  Dictionary: {
    ModeBP: '1',
  },
});

const INN_ORGANIZATION_WEIGHTS = [2, 4, 10, 3, 5, 9, 4, 6, 8] as const;
const INN_PERSON_FIRST_WEIGHTS = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8] as const;
const INN_PERSON_SECOND_WEIGHTS = [
  3,
  7,
  2,
  4,
  10,
  3,
  5,
  9,
  4,
  6,
  8,
] as const;

export type EgrulIdentifierType =
  | 'inn_organization'
  | 'inn_person'
  | 'ogrn'
  | 'ogrnip';

export interface ValidatedEgrulIdentifier {
  value: string;
  type: EgrulIdentifierType;
}

export interface EgrulApiRequest {
  ObjectCode: typeof OBJECT_CODE;
  DocCode: typeof DOC_CODE;
  Links: null;
  Mode: null;
  LicenseKey: string;
  ObjectParameters: string;
  SearchCode: string;
}

export type EgrulApiResponse = unknown;

export interface EgrulApiOptions {
  apiAddress?: string;
  licenseKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class EgrulApiError extends Error {
  readonly statusCode: number | undefined;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'EgrulApiError';
    this.statusCode = statusCode;
  }
}

function calculateWeightedChecksum(
  digits: string,
  weights: readonly number[],
): number {
  const sum = weights.reduce(
    (accumulator, weight, index) =>
      accumulator + Number(digits[index]) * weight,
    0,
  );

  return (sum % 11) % 10;
}

function hasValidInnOrganizationChecksum(identifier: string): boolean {
  return (
    calculateWeightedChecksum(
      identifier.slice(0, 9),
      INN_ORGANIZATION_WEIGHTS,
    ) === Number(identifier[9])
  );
}

function hasValidInnPersonChecksum(identifier: string): boolean {
  const firstChecksum = calculateWeightedChecksum(
    identifier.slice(0, 10),
    INN_PERSON_FIRST_WEIGHTS,
  );
  const secondChecksum = calculateWeightedChecksum(
    identifier.slice(0, 11),
    INN_PERSON_SECOND_WEIGHTS,
  );

  return (
    firstChecksum === Number(identifier[10]) &&
    secondChecksum === Number(identifier[11])
  );
}

function hasValidRegistrationNumberChecksum(
  identifier: string,
  divisor: bigint,
): boolean {
  const body = BigInt(identifier.slice(0, -1));
  const expectedChecksum = Number((body % divisor) % 10n);

  return expectedChecksum === Number(identifier.at(-1));
}

export function validateEgrulIdentifier(
  identifier: string,
): ValidatedEgrulIdentifier {
  const value = identifier.trim();

  if (!/^\d+$/.test(value)) {
    throw new EgrulApiError(
      'Идентификатор должен быть строкой, содержащей только цифры.',
    );
  }

  if (/^0+$/.test(value)) {
    throw new EgrulApiError('Идентификатор не может состоять только из нулей.');
  }

  if (value.length === 10) {
    if (!hasValidInnOrganizationChecksum(value)) {
      throw new EgrulApiError(
        'Некорректная контрольная цифра 10-значного ИНН организации.',
      );
    }

    return { value, type: 'inn_organization' };
  }

  if (value.length === 12) {
    if (!hasValidInnPersonChecksum(value)) {
      throw new EgrulApiError(
        'Некорректные контрольные цифры 12-значного ИНН физического лица или ИП.',
      );
    }

    return { value, type: 'inn_person' };
  }

  if (value.length === 13) {
    if (value[0] !== '1' && value[0] !== '5') {
      throw new EgrulApiError('ОГРН должен начинаться с цифры 1 или 5.');
    }

    if (!hasValidRegistrationNumberChecksum(value, 11n)) {
      throw new EgrulApiError('Некорректная контрольная цифра ОГРН.');
    }

    return { value, type: 'ogrn' };
  }

  if (value.length === 15) {
    if (value[0] !== '3') {
      throw new EgrulApiError('ОГРНИП должен начинаться с цифры 3.');
    }

    if (!hasValidRegistrationNumberChecksum(value, 13n)) {
      throw new EgrulApiError('Некорректная контрольная цифра ОГРНИП.');
    }

    return { value, type: 'ogrnip' };
  }

  throw new EgrulApiError(
    'Неподдерживаемая длина идентификатора: ожидается ИНН из 10 или 12 цифр, ОГРН из 13 цифр либо ОГРНИП из 15 цифр.',
  );
}

export function buildEgrulRequest(
  identifier: string,
  licenseKey: string,
): EgrulApiRequest {
  const validatedIdentifier = validateEgrulIdentifier(identifier);

  return {
    ObjectCode: OBJECT_CODE,
    DocCode: DOC_CODE,
    Links: null,
    Mode: null,
    LicenseKey: licenseKey,
    ObjectParameters: OBJECT_PARAMETERS,
    SearchCode: validatedIdentifier.value,
  };
}

export async function fetchEgrulEntityByIdentifier(
  identifier: string,
  options: EgrulApiOptions = {},
): Promise<EgrulApiResponse> {
  const apiAddress = validateApiAddress(options.apiAddress ?? API_ADDR);
  const licenseKey = options.licenseKey ?? readLicenseKey();
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new EgrulApiError('Тайм-аут запроса должен быть положительным числом.');
  }

  const identifierPayload = buildEgrulRequest(identifier, licenseKey);
  const body = new URLSearchParams({
    identifier: JSON.stringify(identifierPayload),
  });
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetchImpl(apiAddress, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
      },
      body,
      signal: abortController.signal,
    });

    const responseText = await response.text();

    if (!response.ok) {
      const details = responseText.trim();
      const safeDetails = details.replaceAll(licenseKey, '[REDACTED]');
      const suffix = safeDetails ? `: ${safeDetails.slice(0, 1_000)}` : '';
      throw new EgrulApiError(
        `ЕГРЮЛ/ЕГРИП API вернул HTTP ${response.status}${suffix}`,
        response.status,
      );
    }

    if (!responseText.trim()) {
      return null;
    }

    try {
      return JSON.parse(responseText) as unknown;
    } catch {
      return responseText;
    }
  } catch (error: unknown) {
    if (error instanceof EgrulApiError) {
      throw error;
    }

    if (abortController.signal.aborted) {
      throw new EgrulApiError(
        `ЕГРЮЛ/ЕГРИП API не ответил за ${timeoutMs} мс.`,
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new EgrulApiError(
      `Не удалось выполнить запрос к ЕГРЮЛ/ЕГРИП API: ${message}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function formatEgrulResponse(response: EgrulApiResponse): string {
  if (typeof response === 'string') {
    return response;
  }

  return JSON.stringify(response, null, 2);
}
