import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import { SERVER_NAME, SERVER_VERSION } from './config.js';
import {
  fetchOrganizationByInn,
  formatEgrulResponse,
  type EgrulApiResponse,
} from './egrul-api.js';

export const TOOL_NAME = 'get_egrul_organization_by_inn';

export type OrganizationFetcher = (inn: number) => Promise<EgrulApiResponse>;

export function createServer(
  fetchOrganization: OrganizationFetcher = fetchOrganizationByInn,
): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  server.registerTool(
    TOOL_NAME,
    {
      title: 'Получить организацию из ЕГРЮЛ по ИНН',
      description:
        'Возвращает сведения об организации из ЕГРЮЛ по числовому ИНН. ИНН передаётся без пробелов и других символов.',
      inputSchema: z.object({
        inn: z
          .number()
          .int()
          .min(100_000_000)
          .max(9_999_999_999)
          .describe('Числовой ИНН организации из 9–10 цифр'),
      }),
    },
    async ({ inn }) => {
      try {
        const organization = await fetchOrganization(inn);

        return {
          content: [
            {
              type: 'text',
              text: formatEgrulResponse(organization),
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
              text: `Не удалось получить сведения из ЕГРЮЛ: ${message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}
