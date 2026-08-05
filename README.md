# EGRUL INN MCP

STDIO MCP-сервер на TypeScript, который получает сведения об организации из ЕГРЮЛ по числовому ИНН. Сервер использует официальный MCP SDK v2 и рассчитан на Node.js 20 или новее.

## Настройка

Лицензионный ключ в исходный код добавлять не нужно. При запуске сервер читает его только из переменной окружения `LICENSE_KEY`.

## Подключение из Git-репозитория

После отправки проекта в репозиторий добавьте сервер в конфигурацию MCP-клиента. `npx` умеет получать пакет по Git-спецификатору, а единственная запись `bin` в `package.json` позволяет автоматически выбрать команду `egrul-inn-mcp`.

```json
{
  "mcpServers": {
    "egrul": {
      "command": "npx",
      "args": [
        "-y",
        "git+https://gitlab.keysystems.ru/ml/mcp-tools/egrul-mcp#main"
      ],
      "env": {
        "LICENSE_KEY": "YOUR_LICENSE_KEY"
      }
    }
  }
}
```

## Инструмент

| Поле | Значение |
| --- | --- |
| Имя MCP-инструмента | `get_egrul_organization_by_inn` |
| Аргумент | `inn` |
| Тип аргумента | `number`, целое число |
| Пример | `{ "inn": 7707083893 }` |
| Секрет | ENV-переменная `LICENSE_KEY` |
| API | Константа `API_ADDR` в `src/config.ts` |

Запрос отправляется методом `POST` с `Content-Type: application/x-www-form-urlencoded`. Поле формы называется `identifier` и содержит JSON со значениями `DICTIONARY_CORR_EGRUL`, `DICTIONARY_CORR`, `ModeBP: "1"`, лицензией и ИНН.

## Локальная сборка

```bash
npm ci
npm run build
LICENSE_KEY="YOUR_LICENSE_KEY" node dist/index.js
```

Последняя команда запускает STDIO-сервер, поэтому процесс ожидает MCP-сообщения в `stdin`. Служебные сообщения выводятся только в `stderr`, чтобы не повреждать протокольный поток `stdout`.