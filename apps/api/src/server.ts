import { buildApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const app = await buildApp({ config });
await app.listen({ port: config.PORT, host: '0.0.0.0' });
