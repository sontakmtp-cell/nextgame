import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const web = createRequire(resolve('apps/web/package.json'));
const renderer = createRequire(resolve('packages/renderer3d/package.json'));
export default { root: 'tests/u3d04', publicDir: '../../apps/web/public', resolve: { alias: [
 { find: /^react$/, replacement: web.resolve('react') },
 { find: /^react\/jsx-runtime$/, replacement: web.resolve('react/jsx-runtime') },
 { find: /^react\/jsx-dev-runtime$/, replacement: web.resolve('react/jsx-dev-runtime') },
 { find: /^react-dom\/client$/, replacement: web.resolve('react-dom/client') },
 { find: /^@react-three\/fiber$/, replacement: renderer.resolve('@react-three/fiber') },
 { find: /^three$/, replacement: resolve(renderer.resolve('three'), '..', 'three.module.js') },
 { find: /^@prompt-chien\/renderer3d$/, replacement: resolve('packages/renderer3d/dist/index.js') }
] }, build: { outDir: '../../.local/u3d04/dist', emptyOutDir: true }, server: { host: '127.0.0.1', port: 5204, strictPort: true }, plugins: [{ name: 'u3d04-body', async generateBundle() { this.emitFile({ type: 'asset', fileName: 'fixture.json', source: await readFile(resolve('.local/u3d04/fixture.json')) }); }, configureServer(server) { server.middlewares.use('/fixture.json', (_req, res) => { void readFile(resolve('.local/u3d04/fixture.json')).then(bytes => { res.setHeader('Content-Type', 'application/json'); res.end(bytes); }); }); } }] };
