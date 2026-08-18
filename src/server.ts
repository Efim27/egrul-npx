import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import { SERVER_NAME, SERVER_VERSION } from './config.js';
import {
  fetchEgrulEntityByIdentifier,
  formatEgrulResponse,
  validateEgrulIdentifier,
  type EgrulApiResponse,
} from './egrul-api.js';

export const TOOL_NAME = 'search_egrul_egrip_by_identifier';

export type EgrulEntityFetcher = (
  identifier: string,
) => Promise<EgrulApiResponse>;

const identifierSchema = z
  .string()
  .trim()
  .min(1, 'Укажите ИНН, ОГРН или ОГРНИП.')
  .regex(
    /^(?:\d{10}|\d{12}|\d{13}|\d{15})$/,
    'Ожидается строка из 10, 12, 13 или 15 цифр без разделителей.',
  )
  .superRefine((identifier, context) => {
    try {
      validateEgrulIdentifier(identifier);
    } catch (error: unknown) {
      context.addIssue({
        code: 'custom',
        message:
          error instanceof Error
            ? error.message
            : 'Некорректный идентификатор.',
      });
    }
  })
  .describe(
    'ИНН организации (10 цифр), ИНН физического лица или ИП (12 цифр), ОГРН (13 цифр) либо ОГРНИП (15 цифр). Передавайте строкой без пробелов и разделителей.',
  );

export function createServer(
  fetchEntity: EgrulEntityFetcher = fetchEgrulEntityByIdentifier,
): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  server.registerTool(
    TOOL_NAME,
    {
      title: 'Найти организацию или ИП по ИНН, ОГРН либо ОГРНИП',
      description:
        'Ищет сведения в ЕГРЮЛ/ЕГРИП по одному российскому идентификатору: 10- или 12-значному ИНН, 13-значному ОГРН либо 15-значному ОГРНИП. Перед запросом проверяет формат и контрольные цифры.',
      inputSchema: z.object({
        identifier: identifierSchema,
      }),
    },
    async ({ identifier }) => {
      try {
        const entity = await fetchEntity(identifier);

        return {
          content: [
            {
              type: 'text',
              text: formatEgrulResponse(entity),
            },
          ],
        };
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Неизвестная ошибка';

        return {
          content: [
            {
              type: 'text',
              text: `Не удалось получить сведения из ЕГРЮЛ/ЕГРИП: ${message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}
