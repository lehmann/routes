<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Notas do projeto Routes

- **Node 20** (`.nvmrc`). Next 16, Tailwind 4.
- **MapLibre GL fixado em 5.x** (`^5.24.0`). A 6.x não pedia os tiles e disparava `Failed to load module script` no Chrome. Não atualizar sem testar mapa e GPX.
- **`public/sw.js`** não é registrado em dev. Ao alterar, incremente `VERSION` (o `activate` apaga caches antigos). Nunca guarde HTML sob a URL de um script ou asset: o Chrome rejeita com "strict MIME type checking".
- **Layout**: `h-dvh` na raiz; abaixo de `md` (768px) o painel fica empilhado acima do mapa, com `55dvh`.
- **Trilheiro**: GPX em IndexedDB (`routes` / `gpx`); trilhas ocultas em `localStorage` (`routes-trail-hidden`).
- **Git**: não faça commit, push nem abra PR sem pedido explícito do usuário.
