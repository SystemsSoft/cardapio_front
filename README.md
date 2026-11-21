# Cardápio Online — Front

Interface do Cardápio Online: app do cliente na mesa, gestão do restaurante, app do garçom e painel admin.
React 18 + Vite + TypeScript + Tailwind CSS, com Socket.IO para o tempo real.

No ar em **https://cardapioonline.online**. O backend (FastAPI, em Python) serve o build deste projeto e
responde a API em `/api` e o tempo real em `/socket.io` — tudo na mesma origem.

## Rodar no computador

Precisa do Node.js 20 ou mais novo e do backend rodando em `http://localhost:3333`.

```bash
npm install
npm run dev          # http://localhost:5173 (o Vite repassa /api, /uploads e /socket.io para o backend)
```

Para apontar para outro backend: `API_URL=http://outro-endereco:3333 npm run dev`.

Outros comandos:

```bash
npm run typecheck    # checa os tipos
npm run build        # gera dist/
```

## Deploy

**Automático:** todo push na branch `master` roda o workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
instala, checa os tipos, gera o build e publica em `/opt/cardapio/front` no servidor. Também dá para rodar à mão em
**Actions → Deploy → Run workflow**.

- O servidor guarda os 5 últimos fronts publicados em `/opt/cardapio/front-anterior-<data>`.
- Para voltar a uma versão anterior, o caminho normal é reverter o commit (`git revert`) e dar push.
- Se o build ou a checagem de tipos falharem, nada é publicado.

**Configuração (uma vez):** o secret `DEPLOY_SSH_KEY` do repositório guarda a chave privada de deploy.
No servidor, essa chave está presa ao script `/opt/cardapio/deploy/publicar_front.sh` (via `command=` no
`authorized_keys`): ela só consegue publicar o front, não dá acesso ao terminal nem aos dados.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/pages/cliente` | Cardápio, carrinho, pedidos e conta (`/cliente/:rid/mesa/:numero?t=...`) |
| `src/pages/gestao` | Área do restaurante (`/gestao/...`) |
| `src/pages/garcom` | App do garçom com notificações push (`/garcom/:rid?t=...`) |
| `src/pages/admin` | Painel da plataforma (`/admin`) |
| `src/lib` | API, tempo real, formatação, som e cor da marca |
| `src/components` | Componentes de interface |
| `public/` | Ícones, service worker do garçom (`sw-garcom.js`) e mídias da landing |

As URLs `/cliente/...` e `/garcom/...` são as mesmas dos QR Codes impressos — não mude sem gerar QR Codes novos.
