/** Renderer → main: asks for a new backend port (one per page load). */
export const CONNECT_BACKEND = 'zinc:connect-backend';

/**
 * Main → preload → main world: carries the backend port. Must match
 * `BACKEND_PORT_MESSAGE` in `apps/zinc-web/src/hostBackend.ts`.
 */
export const BACKEND_PORT = 'zinc:backend-port';
