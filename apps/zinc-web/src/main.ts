import { configureCtx } from '@zinc-project/ui-state';
import { connectHostBackend } from './hostBackend.js';

configureCtx(await connectHostBackend());

// Defining <zinc-app> starts the UI-state worker, so it waits for the backend transport.
await import('@zinc-project/ui');
