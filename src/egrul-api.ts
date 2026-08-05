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

export function normalizeOrganizationInn(inn: number): string {
  if (!Number.isSafeInteger(inn) || inn < 100_000_000 || inn > 9_999_999_999) {
    throw new EgrulApiError(
      'ИНН организации должен быть безопасным целым числом из 9–10 цифр.',
    );
  }

  return String(inn).padStart(10, '0');
}

export function buildEgrulRequest(
  inn: number,
  licenseKey: string,
): EgrulApiRequest {
  return {
    ObjectCode: OBJECT_CODE,
    DocCode: DOC_CODE,
    Links: null,
    Mode: null,
    LicenseKey: licenseKey,
    ObjectParameters: OBJECT_PARAMETERS,
    SearchCode: normalizeOrganizationInn(inn),
  };
}

export async function fetchOrganizationByInn(
  inn: number,
  options: EgrulApiOptions = {},
): Promise<EgrulApiResponse> {
  const apiAddress = validateApiAddress(options.apiAddress ?? API_ADDR);
  const licenseKey = options.licenseKey ?? readLicenseKey();
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new EgrulApiError('Тайм-аут запроса должен быть положительным числом.');
  }

  const identifier = buildEgrulRequest(inn, licenseKey);
  const body = new URLSearchParams({
    identifier: JSON.stringify(identifier),
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
        `ЕГРЮЛ API вернул HTTP ${response.status}${suffix}`,
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
        `ЕГРЮЛ API не ответил за ${timeoutMs} мс.`,
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new EgrulApiError(`Не удалось выполнить запрос к ЕГРЮЛ API: ${message}`);
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
