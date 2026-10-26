# Routes — frontend (Next.js)

Interface do planejador de rotas e do Trilheiro. A visão geral do projeto, o setup completo (OTP2 incluso) e a documentação da API estão no [README da raiz](../README.md).

## Desenvolvimento

```bash
nvm use          # Node 20 via .nvmrc
npm install
npm run dev      # http://localhost:3000
```

O service worker só é registrado em produção (`NODE_ENV=production`), então teste o modo offline com o build de container ou com `npm run build && npm start`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção (o mesmo usado pelo container) |
| `npm run start` | sobe o build de produção |
| `npm run lint` | ESLint |

## Pontos de atenção

- **MapLibre GL** está fixado na linha 5.x. Não atualizar para 6.x sem testar o mapa e o carregamento de GPX.
- **`public/sw.js`**: ao alterar, incremente `VERSION`.
- **Layout**: `h-dvh` na raiz e painel empilhado abaixo de `md` (768px).
