# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project

**Zinc** is navigation software for orienteering in 4x4 off-road races (rally-raid / trophy). Its user is the **navigator** ("shturman"), who sits in a moving vehicle with a rugged tablet or laptop. They use hotkeys or large touch targets, often without network access. The app shows the vehicle on offline raster maps and guides it through control points (waypoints with a proximity radius, a score and a time window) and routes. It records tracks and runs a rally tripmeter.

zinc-project is the next generation of **shturmen-zinc**, "Zinc Navigation" v1.4.6, built on NW.js 0.46, Angular 7 and OpenLayers 6, and Windows only. The legacy source is at `/home/gorokh/work/github/shturmen-zinc-fe10db835d5b`. Treat it as **reference only**: never copy its architecture, only its behaviour. The full domain and feature reference is in [docs/legacy-shturmen-zinc.md](docs/legacy-shturmen-zinc.md). Read it before you implement any domain feature.

The architecture is stream-first. Services are rxjs throughout, and every boundary between execution contexts goes through `rxjs-bridge` (`/home/gorokh/work/github/rxjs-bridge`, maintained by the same author).

## Current state (scaffold only)

**Existing projects:**
- `@zinc-project/zinc-server`: Fastify 5, built with swc. `src/app/plugins/backend.ts` is the backend composition root: it starts the DB worker, builds the backend services and hosts them over `ws` at `/rx`. `GET /api/maps/:mapId/tiles/:z/:x/:y` serves tiles from `MapsService.getTile`. Data lives in `ZINC_DATA_DIR`, defaulting to `~/.local/share/zinc` or `%APPDATA%/zinc`.
- `@zinc-project/zinc-server-e2e`: Vitest. Global setup starts the built server on a free port with a temp `ZINC_DATA_DIR` and stops it afterwards. The specs talk to the server over HTTP and the rxjs-bridge WebSocket.
- `@zinc-project/browser-shell`: development-only Vite app (`nx serve @zinc-project/browser-shell`, port 4200) that mounts `<zinc-app>` for live reload and browser debugging. It proxies `/api` and `/rx` to the server on port 3000, so run `npm run server` alongside it. VS Code has a "Debug browser-shell in Chrome" launch config for it.
- **Maps** (the first feature that runs end to end):
  - `libs/utils`: `formats/znc.ts` parses and writes `.znc`, and `tiles/tileGrid.ts` holds the grid math and URL templates.
  - `libs/contracts`: `db/mapStore.base.ts`, `backend/maps.base.ts` and `worker/mapLayers.base.ts`.
  - `libs/data`: the DB worker (`src/worker.ts`, started via `createDataWorker`) keeps one better-sqlite3 `<id>.znm` file per map. Each file holds the map config and its tile BLOBs.
  - `libs/backend`: `MapsService` holds one `MapHandler` per map and serves tiles cache-first. A shared `TileDownloader` caps requests at 64 in flight and retries failures. `hostMapsService()` exposes the service over any transport host.
  - `libs/ui-state-worker`: a `remote/` WebSocket bridge to `maps`, and `MapLayersService.activeMap$` (currently the first map).
  - `libs/ui-state`: `MapEngine.setBaseMap()` builds an OL tile source from a `MapInfo`, registering proj4 grids when needed.
- **Tile coordinates are OpenLayers tile coords everywhere**: `y` grows down from the grid origin, so it is negative for bottom-left origins. Download templates use `{-y}` for TMS rows. Tile bytes go over HTTP, never through a JSON socket bridge.
- `libs/ui-state`: `MapEngine` (`src/lib/map/`) wraps OpenLayers. It takes and returns WGS84 `[lon, lat]` and exports the OL stylesheet as `mapEngineCss`.
- `libs/ui`: Lit, built with Vite. `<zinc-app>` is the root component and renders `<main-map-view>`, which mounts `MapEngine` in its shadow root.
- `libs/logger` and parts of `libs/utils`: placeholder sources with Vitest, built with tsc.

**Already set up:**
- `rxjs` and `rxjs-bridge` are installed.
- Tags and `depConstraints` are enforced in `eslint.config.mjs`.
- `experimentalDecorators: true` and `useDefineForClassFields: false` are set in `tsconfig.base.json`. rxjs-bridge stubs and Lit need both.

**Not created yet:** the shell apps (`zinc-web`, `zinc-electron`, `zinc-android`).

**Not installed yet:** Electron, Capacitor and nodejs-mobile. OpenLayers (`ol`) and `proj4` are installed in `libs/ui-state`, `ws` in zinc-server, and `better-sqlite3` in `libs/data`.

`better-sqlite3` is a native module. Before shipping each platform it needs:
- `electron-rebuild` for Electron;
- an arm64 build for nodejs-mobile;
- the `.node` file shipped beside the Node SEA binary.

**rxjs-bridge gaps found so far:** `WebSocketHandler` has no stop/close method, the socket transport is JSON-only (no binary), and the `@WorkerThreadHost` decorator throws when its module is imported outside a worker thread.

Don't assume an app exists; check with `npx nx show projects`. When you create a project, follow the layout below and add its tags in the `nx.tags` field of its `package.json`.

## Target architecture

### Platforms and runtime topology

Every platform runs the same contracts. Only the transport between the frontend and the Node backend changes.

| Platform | Frontend | Node backend tier runs in | Frontend ↔ backend transport |
|---|---|---|---|
| Desktop: Electron, Linux + Windows (Windows cross-compiled from Linux) | renderer | Electron **main process** | **new** rxjs-bridge Electron IPC / MessagePort transport |
| Android: Capacitor | WebView | **embedded Node** (nodejs-mobile / capacitor-nodejs) | **new** rxjs-bridge nodejs-mobile channel transport |
| Headless: Node SEA, Linux only | any browser | `zinc-server` (Fastify + `ws`) | WebSocket (`@WebSocketHost` / `@WebSocketBridge`) |

Four execution contexts, each linked to the next by rxjs-bridge:

```
UI main thread (libs/ui + libs/ui-state)       Lit, OpenLayers, DOM, input devices
   │  @WorkerBridge / @WorkerHost               Web Worker postMessage
Web Worker (libs/ui-state-worker)               frontend app logic, view models
   │  platform transport (IPC | channel | WebSocket)
Node backend (libs/backend, hosted by app)      GPS I/O, tiles, import/export
   │  @WorkerThreadBridge / @WorkerThreadHost   worker_threads
DB worker (libs/data)                           SQLite, never on the backend main thread
```

- **New transports go upstream into `rxjs-bridge`**, not into this repo. A client transport subclasses `SocketHandler` (`output$`, `connected$`, `send`, `start`). Each transport also needs a host-side counterpart equivalent to `IHostSocketHandler`.
- **The backend tier is identical on all three platforms.** Platform differences (serial port, Bluetooth, USB, file paths, app data dir) sit behind interfaces in `libs/backend` and are wired up by the hosting app. Native modules must build for Electron (Linux and Windows), nodejs-mobile (Android arm64) and Node SEA. Check this before you add any native dependency.

### Libs and apps (planned)

| Project | Tags | Runs in | Contents |
|---|---|---|---|
| `libs/dto` | `type:dto`, `scope:shared` | any | Plain types and enums. No logic, no rxjs. |
| `libs/utils` | `type:util`, `scope:shared` | any | Pure code only: no rxjs, no I/O, no platform APIs. Heavily unit-tested. **`src/lib/geo/`**: WGS84 geodesy (distance, initial bearing, destination by bearing+distance) and nav math (proximity, remaining distance, availability windows crossing midnight, coordinate formatting and parsing). **`src/lib/formats/`**: parsers and writers for NMEA (incl. `$PPIOW`), UBX HNR-PVT, GPX 1.1 + `zinc:` extensions (namespace declared), OziExplorer `.wpt`/`.plt`, and `.znc` map config. |
| `libs/logger` | `type:util`, `scope:shared` | any | Logger with `child()`; rx diagnostics operator. |
| `libs/contracts` | `type:contracts`, `scope:shared` | any | All `*.base.ts` bridge contracts (`extends RxjsBridge`), one folder per boundary (`worker/`, `backend/`, `db/`). It must never import implementations. |
| `libs/data` | `type:data`, `scope:node` | DB worker | SQLite entities, versioned migrations, table services implementing `contracts/db`. |
| `libs/backend` | `type:backend`, `scope:node` | Node backend | GPS devices (serial NMEA/UBX, BT SPP, Garmin USB PVT), track recording, tile sources and tile serving, map download, import/export. Also the `@WorkerThreadBridge` stubs for `contracts/db`. It reaches the DB only through them and never imports `libs/data`. |
| `libs/ui-state-worker` | `type:ui-state-worker`, `scope:worker` | Web Worker | Frontend business logic. `remote/*` clients for the backend contracts, handlers/state, ready-to-render view models, `@WorkerHost` services. |
| `libs/ui-state` | `type:ui-state`, `scope:browser` | UI thread | `@WorkerBridge` stubs, the `ctx` DI container, OpenLayers map engine, hotkeys and input, and anything else that needs the DOM or canvas. |
| `libs/ui` | `type:ui`, `scope:browser` | UI thread | Lit components and screens. Rendering and user input only. |
| `apps/zinc-web` | `type:shell` | browser | Vite bundle that mounts the UI; shared by all shells. |
| `apps/zinc-electron` | `type:shell` | Electron | Main process hosts the backend over the IPC transport; renderer loads zinc-web. |
| `apps/zinc-android` | `type:shell` | Capacitor | Capacitor shell plus the embedded Node project hosting the backend. |
| `apps/zinc-server` | `type:server` | Node / SEA | Fastify + `ws`: hosts the backend over WebSocket and serves zinc-web statically. |

The allowed dependencies form a single direction. `eslint.config.mjs` enforces them through `depConstraints`, so update both together.

```
dto             → —
util            → dto, util
contracts       → dto, util                         (+ rxjs, rxjs-bridge)
data            → contracts, dto, util
backend         → contracts, dto, util              (DB via contracts/db bridge stubs)
ui-state-worker → contracts, dto, util              (never backend/data)
ui-state        → ui-state-worker, contracts, dto, util
ui              → ui-state, contracts, dto, util    (view-model types come from contracts)
shell           → ui, ui-state, contracts, dto, util
server          → backend, data, contracts, dto, util   (host app: also bootstraps the DB worker)
e2e             → *
scope:shared → shared · scope:node → node, shared · scope:worker → worker, shared
scope:browser → browser, worker, shared
```

Electron main and the Android embedded-Node project host the backend in the same way the server does, so tag them `type:server`, `scope:node`. Tag their UI/renderer parts `type:shell`.

### Layering rules

- **ui renders, ui-state-worker decides.** `libs/ui` only renders streams and forwards user input as calls on `ctx` services. It does not derive statuses, compute distances, sort or filter domain data, or pick labels. Expose a view model from ui-state-worker and unit-test it there.
- **`libs/ui-state` holds only main-thread-bound code**: the map engine (OpenLayers), DOM, canvas, keyboard and gamepad, audio alarms.
- **i18n split:** the worker returns i18n keys plus params, and the UI translates. Languages are EN, RU and LV.
- **Shells hold only platform glue** (bootstrap, polyfills, native plugin wiring).
- **Composition roots wire dependencies by hand**: `WorkerContext` in ui-state-worker, backend bootstrap in each host app, DB worker bootstrap. The constructors take their dependencies explicitly.
- **Import across libs only via `@zinc-project/<lib>`**, never with relative paths or `libs/x/src/...` deep imports.

## rxjs conventions

- A service's public surface is made of **`x$: Observable<T>` properties** for state and **methods returning `Observable<T>`** for actions and parameterized reads. Promises never cross a boundary, and fire-and-forget actions return `Observable<void>`.
- **Naming:** observables use the `$` suffix. Members are camelCase (`activePoint$`, `setActiveLeg()`).
- **State:** private `_x$ = new BehaviorSubject(...)`, public `x$ = this._x$.pipe(shareReplay({ bufferSize: 1, refCount: true }))`. Event streams that must not replay use `share()`.
- **Derived state** comes from `combineLatest` / `switchMap` / `distinctUntilChanged`. Actions read the current state with `take(1)` + `switchMap`.
- **Teardown:** each per-entity handler has `onDestroy$ = new ReplaySubject<void>(1)`, and each of its streams uses `takeUntil(this.onDestroy$)`. `destroy()` calls `next()` and then `complete()`. A child handler also stops on its parent's `onDestroy$`. Lit components unsubscribe in `disconnectedCallback`; prefer one shared reactive controller or directive for subscribing.
- **Errors:** use `catchError` to a sensible default at domain edges, and `retry({ count, delay })` for I/O. Install a `config.onUnhandledError` policy in every JS context (UI, worker, backend, DB worker).
- **High-rate input:** GPS can arrive at 10 Hz or more. Throttle or sample in the stream (`auditTime`, `sampleTime`), never with fixed `setInterval` polling.
- **Tests:** Vitest. Assert with `await firstValueFrom(...)` or `lastValueFrom`, and never inside an un-awaited `subscribe()`. Prefer small stubs over wiring real handlers.

## rxjs-bridge rules

- **One contract = three parts:**
  - an abstract `XServiceBase extends RxjsBridge` in `libs/contracts`, with every member returning `Observable`;
  - a **host**, `@WorkerHost` / `@WebSocketHost` / `@WorkerThreadHost` / new transport host, which is the real implementation;
  - a **bridge stub**, `@WorkerBridge` / `@WebSocketBridge` / `@WorkerThreadBridge` / new transport bridge, whose method bodies `throw new Error('bridge stub')`.
- **Host members must be the class's own members.** The handshake uses `Object.getOwnPropertyNames` on the instance and the prototype, so delegate explicitly rather than relying on inherited methods.
- **A parameterless read is a property** (`@WorkerObservable(...)` / `@SocketObservable(...)` on `x$`). Methods are for actions and for reads that take arguments.
- **Socket method streams complete on disconnect.** Declare long-lived parameterized reads as `@SocketMethod(repeat())`. Observable properties resubscribe on reconnect automatically. Check this behaviour for each new transport too.
- **Payloads must survive structured clone or JSON**, so send no class instances, functions or `Map`. Errors arrive as plain objects (`message`, `stack`), not `Error` instances.
- **Service names** are string constants exported next to the contract. Keep a single instance of each bridge stub.
- **TS config:** `tsconfig.base.json` sets `experimentalDecorators: true` and `useDefineForClassFields: false`, which bridge stubs need. Without the second setting, a `x$!: Observable` field would shadow the decorator's accessor. Runtime transforms must use legacy decorators as well: swc `decorators` + `legacyDecorator` (see `libs/ui/.swcrc`), and `unplugin-swc` in Vite/Vitest for projects that contain decorated classes. Point `unplugin-swc`'s `tsconfigFile` at a real tsconfig (it reads `experimentalDecorators`/`useDefineForClassFields` from it). Vite configs that consume workspace libs set `resolve.conditions: ['@zinc-project/source', ...defaultClientConditions]` so they compile lib sources, not stale `dist` builds.
- **Browser bundles:** `rxjs-bridge`'s ESM bundle imports `worker_threads`, so browser and worker bundles must alias or stub it in Vite.
- **Diagnostics:** log `rxjsBridgeHealthMonitor.checkHealth()` periodically in the worker and the backend to catch leaked subscriptions.

## Domain essentials

The details, entity fields and legacy file paths are in [docs/legacy-shturmen-zinc.md](docs/legacy-shturmen-zinc.md).

- **Coordinates.** Persist and transport **WGS84 degrees**. Convert to EPSG:3857 (or a map's own proj4 projection) only inside the OpenLayers layer in `libs/ui-state`. Compute all distances and bearings geodesically in `libs/utils` (`geo/`), **never with atan2 on Mercator coordinates**. The legacy app stored Mercator metres in `latitude`/`longitude` columns and computed bearings in Mercator; don't repeat that.
- **Waypoint / control point.** Has a group, a **proximity** radius (default 30 m), a **value** (score), an optional **availability window** (which may cross midnight), label and radius styling, and a **state**: new, later, later-but-left-radius, taken, unreachable.
- **Route → legs → guide lines.** A route is an ordered list of waypoints. Each leg can have several alternative, editable guide polylines; the shortest one is the leg distance. The active route auto-advances when the vehicle enters the active point's proximity. It supports next/previous and shows the distance to the point and the total remaining.
- **Track → lines (segments) → points.** Recorded automatically per GPS device at 1 Hz max. A new track starts each calendar day, and a new segment starts after a reconnect. Tracks can be drawn in a solid colour or coloured by speed.
- **GPS devices.** Several devices can run at once:
  - serial NMEA/UBX (u-blox HNR-PVT takes priority over RMC/GGA/VTG);
  - Bluetooth SPP;
  - Garmin USB PVT.

  Each device reports fix / frozen (3 s without data) / off status and satellite SNR, and has display settings: pointer, range rings, course line.
- **Tripmeter.** odo1, odo2 and average speed, each resettable. **Projection** plots a target from the current position given a course (°) and a distance, keeps a queue of future projections, and can optionally generate A/B waypoints.
- **Maps.** Offline-first raster tile sources: SASPlanet cache, TMS folders, MBTiles, Locus and OsmAnd sqlitedb, and **ZNM** (Zinc's SQLite tile container). There are also online sources defined by a URL template plus headers. Any proj4 grid works, with per-level origins and tile sizes. Other map features:
  - polygon area download with resume, optionally packed into ZNM;
  - **presets** (stacks of layers with opacity and z-order);
  - cycling through maps with one key.
- **Cockpit UX.** Every action can be bound to a hotkey. There is an on-screen coordinate keypad (formats `d°m′s.s″`, `d°m.mmm′`, `d.dddddd°`), a fullscreen big-digit odometer, course-up rotation, follow mode and an over-speed alarm with sound.
- **Interop.** Import and export GPX 1.1 (Garmin `wptx1:Proximity` plus `zinc:` extensions) and OziExplorer `.wpt`/`.plt`. Waypoints can be injected via the `$PPIOW` NMEA sentence. Map configs use `.znc` (JSON).

## Do not carry over from legacy

- Raw SQL built in UI layers, and active-record setters that write to the DB on every assignment. Persistence belongs only behind `contracts/db`, with versioned migrations.
- Navigation-critical state (active route, leg, odometers, camera) in `localStorage`. It goes in SQLite through the backend.
- User-supplied JavaScript tile scripts executed with `new Function`. Use declarative URL templates and headers.
- `--disable-web-security`, mixed Node/browser contexts, and a renderer with Node integration. Electron renderers run sandboxed, with `contextIsolation`.
- Windows-only assumptions (`COM1..COM50`, `\\` paths, the Public folder). Enumerate ports and use the platform app-data dir.
- Hardcoded secrets, machine-ID whitelists, plain-HTTP update and activation.
- Fixed-interval polling loops. Use event-driven streams.

## Commands

```bash
npx nx show projects                                   # what actually exists
npx nx graph                                           # dependency graph
npx nx run-many -t lint test build typecheck           # same as CI
npm run server                                         # = nx serve zinc-server: Fastify dev server, rebuilds + restarts on change (PORT, HOST env)
npm run shell                                          # = nx serve browser-shell: UI dev server with HMR on http://localhost:4200
npx nx test @zinc-project/ui                           # Vitest for one lib
npx nx e2e @zinc-project/zinc-server-e2e               # Vitest e2e (builds server, spawns it on a free port)
cd libs/<lib> && npx vitest run src/path/to/x.spec.ts  # single spec
```

## TypeScript / Nx conventions

- **npm workspaces** (`apps/*`, `libs/*`). Each project's targets live in its own `package.json` (`nx` key) or are inferred by plugins (`@nx/js/typescript`, `@nx/eslint`, `@nx/vite`, `@nx/vitest`).
- **Resolution uses TS project references, not `paths` aliases.** Each lib's `package.json` `exports` carries a `"@zinc-project/source": "./src/index.ts"` condition, enabled via `customConditions` in `tsconfig.base.json`. Add every new project to the root `tsconfig.json` `references`.
- **Compiler settings:** `module`/`moduleResolution: nodenext`, `strict`, `noUnusedLocals`, `noImplicitReturns`, `noImplicitOverride`, `isolatedModules`, target es2022.
- **Builds:** swc for Node projects (`.swcrc` per project), Vite for web projects. Tests: Vitest everywhere; Jest is not used.
  - Unit tests: each project's `vite.config.*` or `vitest.config.*`, collected by `vitest.workspace.ts`.
  - E2e: `vitest.e2e.config.mts`, run only through the explicit `e2e` target, so `test` runs never start a server.
- **Lint and format:** ESLint 9 flat config (`eslint.config.mjs`) with `@nx/enforce-module-boundaries`; Prettier with `singleQuote: true`.
- **File naming:** camelCase `.ts`. Bridge-related suffixes:

  | Suffix | Meaning |
  |---|---|
  | `x.base.ts` | contract |
  | `x.host.ts` | bridge host |
  | `x.bridge.ts` | bridge stub |
  | `xView.ts` | pure view-model builder |
  | `x.spec.ts` | colocated test |
