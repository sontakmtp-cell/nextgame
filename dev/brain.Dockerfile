FROM node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/ packages/
COPY scripts/compile-job.mjs scripts/compile-job.mjs
RUN npm exec --yes --package=pnpm@10.34.6 -- pnpm --filter @prompt-chien/contracts --filter @prompt-chien/brain --filter @prompt-chien/content install --prod --frozen-lockfile
USER 1000:1000
ENTRYPOINT ["node", "--max-old-space-size=160", "scripts/compile-job.mjs"]
