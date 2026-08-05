export const API_ADDR = 'https://services.keysystems.ru/egrul/LoadOutcome';

export const SERVER_NAME = 'egrul-inn-mcp';
export const SERVER_VERSION = '1.0.0';
export const REQUEST_TIMEOUT_MS = 30_000;

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function readLicenseKey(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const licenseKey = env.LICENSE_KEY?.trim();

  if (!licenseKey) {
    throw new ConfigurationError(
      'Не задана обязательная переменная окружения LICENSE_KEY.',
    );
  }

  return licenseKey;
}

export function validateApiAddress(apiAddress: string = API_ADDR): string {
  if (!apiAddress || apiAddress === 'REPLACE_WITH_API_ADDRESS') {
    throw new ConfigurationError(
      'Укажите адрес ЕГРЮЛ API в константе API_ADDR файла src/config.ts и пересоберите пакет.',
    );
  }

  let url: URL;

  try {
    url = new URL(apiAddress);
  } catch {
    throw new ConfigurationError(
      'Константа API_ADDR должна содержать корректный абсолютный URL.',
    );
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ConfigurationError(
      'Константа API_ADDR должна использовать протокол HTTPS или HTTP.',
    );
  }

  return apiAddress;
}
