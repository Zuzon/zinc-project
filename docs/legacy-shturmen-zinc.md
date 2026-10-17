# Legacy reference: shturmen-zinc ("Zinc Navigation" v1.4.6)

This is a behavioural reference for the rewrite. The legacy source is at `/home/gorokh/work/github/shturmen-zinc-fe10db835d5b`. Paths below are relative to that directory, and `Globe/src/app/` is shortened to `app/`. The repo has no git history.

Use this document to answer **what** the app must do. For **how** to build it, follow [CLAUDE.md](../CLAUDE.md), not the legacy code.

## 1. Legacy stack

| Aspect | Legacy |
|---|---|
| Runtime | NW.js 0.46.2, with `--enable-node-worker --mixed-context --disable-web-security`. Uses `nw.*` and `chrome.bluetooth*` APIs. |
| UI | TypeScript 3.1, Angular 7, Angular Material 7, flex-layout, RxJS 6.3, ngx-translate. Jade/Pug templates and SCSS. |
| Map | OpenLayers 6.4.3, proj4 2.5. Custom Angular↔OL wrapper in `app/ol3ng2/`. |
| Storage | SQLite (forked `sqlite3`). DB files `zinc.navi` (navigation data) and `zinc.config` (configuration), stored in the Windows Public folder. |
| Native modules | `serialport` 9, `usb`, `iconv`, `node-expat`, `sqlite3`, and the custom `node-garmin` addon (C++/NAN, Win32 only). All are rebuilt with `nw-gyp`. |
| Build | webpack 4 with AOT. Bundles: `main`, `splash`, `dbworker`, `serialportworker`, `garminworker`. |
| Packaging | `nwjs-builder-phoenix` producing an NSIS installer, plus a "Nightly" SDK variant (`Globe/night/`) and older Inno Setup scripts (`build/`). |
| Target | Windows x64/ia32 on rugged tablets (Panasonic, Getac, Xplore). |
| Updates | The splash screen checks `http://zeiza.eu:6970/versions.nsis.json`. |
| Tests | None. |

### Folder map
- `build/`: installer assets.
- `node-garmin/`: Windows C++ addon. Speaks the Garmin USB protocol via SetupAPI (GUID `2c9c45c2-8e7d-4c08-a12d-816bbae722c0`): Start Session, Product Request, Start PVT (cmd 49). Reads PVT (20/51) and satellite (20/114) packets. **Live position only**: it cannot upload or download waypoints or tracks.
- `Globe/src/splash/`: the splash window. Runs the update check, opens the main window minimized and waits for `waypointsLoaded` / `tracksLoaded` / `routesLoaded` / `mapsLoaded`.
- `app/app.component.ts`, `app/tpl.jade`: the main shell, described in section 6.
- `Globe/src/environments/app.providers.ts`: factory-based DI for all services.
- `app/services/`: business logic. Models are in `services/models/`, workers in `services/workers/`.
- `app/parsers/`: NMEA, UBX, GPX, Ozi `.wpt`/`.plt`, and a mixed NMEA/UBX byte-stream splitter (`readline.ts`).
- Feature UI folders: `viewer/`, `interactions/`, `measure/`, `waypoints/`, `tracks/`, `routes/`, `activeRoute/`, `tripmeter/`, `pointList/`, `pos/`, `gpsManager/`, `gpsDevices/`, `maps/` (`editor/`, `downloader/`), `mapPresets/`, `mapScanner/`, `cacheLoader/`, `camera/`, `hotkeys/`, `commonSettings/`, `settings/`, `access/`, `dataExport/`.
- `app/common/`: constants, coordinate dialog, `arrowGenerator.ts`, `clusterGenerator.ts`, pipes, translations (`en`, `ru`, `lv`; `lt` is empty).

## 2. Domain model

> The legacy `latitude`/`longitude` columns hold **EPSG:3857 metres**, not degrees. The new app stores WGS84 degrees.

Schema: `app/services/workers/naviDb.ts` and `configDb.ts`.

| Entity | Legacy file | Fields and behaviour |
|---|---|---|
| WaypointGroup | `services/models/waypointGroup.ts` | `name`, `show` (visibility). An imported file becomes a group. |
| Waypoint | `services/models/waypoint.ts` | `name`, `groupId`, coordinates, `proximity` (active radius in m, default 30), `value` (score), `state`, time window `fromHour/fromMinutes/tilHour/tilMinutes/useTime` (may cross midnight), label style `textSize/textColor/textOutlineColor`, radius style. Methods `pointAvailable(date)` and `timeLeft(date)`. |
| Waypoint state | same file and `pointList/component.ts` | **0** new, **1** later, **2** later but out of radius again, **3** taken, **4** unreachable/rejected. Each has its own style: default, taken, rejected. |
| Route | `services/models/route.ts` | `name`, `show`, `color`, `width`, `legs[]`, `dist`. Styles for current, next, low-priority and edit. Supports `addLeg`, `removeLeg` and `reorder`; `filterRoute` drops consecutive duplicate points. |
| RouteLeg | `services/models/routeLeg.ts` | `wptId` (refers to a Waypoint), `indexNumber`, `lines[]`, `notifications[]`. Leg distance is the **minimum** of its lines' lengths. Leg 0 has no lines. |
| RouteLegLine | `services/models/routeLegLine.ts` | An alternative guide polyline from the previous point to this one. Editable on the map. |
| RouteLegNotification | `services/models/routeLegNotification.ts` | `proximity`, `proximitySteps`, `message`, `type`, `direction` (STRAIGHT / LEFT_90 / RIGHT_90). **Stored but never triggered**, and its editor is disabled. |
| Track / TrackLine / TrackPoint | `services/models/track.ts`, `trackLine.ts`, `trackPointService.ts` | Track `type` is `solid` or `spd` (speed-coloured). Speed thresholds `lowSpd/midSpd/highSpd` are 0/35/70 km/h, each with a colour. A line is one segment. A point has a coordinate, altitude, course, speed, date and index. |
| Gps (device) | `services/models/gps.ts` | `type`: 0 serial NMEA/UBX, 1 Garmin USB, 2 Bluetooth SPP, 3 reserved "internal". Display: `pointerType` (1 arrow, 2 cross), `color`, range rings (`rrCount/rrRadius/rrWidth/rrColor`), course line (length in m, width, colour). Links: `trackId`, `unitId`, `address`/`uuid`, `baudRate`, `portName`. |
| Map | `services/models/map.ts`, `common/constants/mapType.ts` | `type` ∈ `sas`, `tms`, `znm`, `mbtiles`, `locus`, `osmand`. Fields: `path`, `extension`, `epsg`, `useProj`/`proj` (proj4 string), `extent`, `origin(s)`, `resolutions`, `tileSizes`, `useServer`, `tileScript`, `urlHeaders`. |
| MapPreset | `services/models/mapPreset.ts` | A named stack of `MapPresetLayer {mapId, opacity, zIndex, levels, visible}`. Persistence is broken in the legacy app. |
| MapDownloadSession | `services/models/mapDownloadSession.ts` | Polygon area, resolutions, resume cursor `currentRes/X/Y`, `requestLimit`, `preload`, optional packing to `.znm`. |
| Hotkey | `services/models/hotkey.ts` | `keyCode` → named action. The action list is in `hotkeyService.ts` `initActions`. |
| DestProjection | `services/models/destProjection.ts` | `{angle, distance}`: one queued tripmeter projection. |

## 3. GPS input

Code: `services/models/gps.ts`, `gpsService.ts`, `pvtService.ts`, `parsers/*`.

**Serial**
- `serialport` with a selectable port and baud rate (default 4800).
- The legacy port list is a hardcoded `COM1..COM50`. Enumerate real ports instead.

**Bluetooth SPP**
- Paired devices are auto-registered as GPS devices.
- PRO-only in the legacy app.

**Stream splitting**
- A single byte stream can mix NMEA (starting with `$`) and UBX (starting with `0xB5 0x62`).

**NMEA** (`parsers/nmea.ts`)
- Parses GGA, GSA, RMC, VTG, GSV, GLL, ZDA and GST, with XOR checksum validation.
- Only GGA, RMC, VTG, GSA and GSV are acted on.

**UBX**
- Only **HNR-PVT** (class 0x28, id 0x00) is handled.
- Once it has been seen on a device, RMC, GGA and VTG from that device are ignored.

**`$PPIOW` proprietary sentence**
- Format: `$PPIOW,name,lat,N,lon,E,value,textSize,textColor,outline,proximity,width,color*CS`.
- Creates a waypoint in a group named after the device.

**Garmin USB PVT**
- Speed = √(north² + east²) · 3.6.
- Altitude = `alt + msl_hght`.
- Time = 1989-12-31 + `wn_days` + `tow`. The legacy code ignores leap seconds; fix that.
- Course is derived from consecutive positions. Compute it geodesically.
- Hotplug triggers on USB VID 2334 / PID 3.

**Status**
- A device is **frozen** if no valid sentence arrives for 3 s.
- Events: fix change, position update, course update, data update.
- Satellite SNR bars are shown in the GPS manager.

**Time source**
- The first GPS fix is also used as the time source.

## 4. Track recording

- Each GPS device auto-creates a track named `"<device> d.m.yyyy"`.
- At most one point per second.
- A new track starts when the calendar day changes.
- After a reconnect, recording continues in a new line (segment).
- Tracks are rendered in a solid colour or coloured by speed using the thresholds in section 2.

## 5. Maps

### Tile sources
| Type | Layout / storage |
|---|---|
| SAS (SASPlanet cache) | `z{z}/{x/1024}/x{x}/{y/1024}/y{y}.ext` |
| TMS | Standard `z/x/y` folders |
| ZNM | Zinc SQLite container. Tables `ZnmConfig` and `ZnmTile`; tiles keyed by a padded `xxxxxxxyyyyyyyzzz` code, stored as base64 images. |
| MBTiles | Standard |
| Locus / OsmAnd | sqlitedb, with `z` stored as `17 - z` |
| Online | Legacy used a user JS `tileScript` that returned a URL or `{url, headers}`. The DB worker downloaded with retry and timeout, gunzipped when needed, and wrote to the file cache. **The new app replaces this with a declarative URL template plus headers.** |

- On first run the app creates an "OpenStreetMap" online map.
- The view projection is EPSG:3857. A map with its own proj4 projection is reprojected by OpenLayers.
- Maps are discovered by scanning folders (`scanService.ts`) and by sniffing SQLite tables (`mapValidator.ts`).
- `.znc` is a JSON map-configuration file used for import and export.
- The map editor includes a code editor for the tile script, and there is a debug-tiles overlay.
- **View modes:** single map, or a preset (several layers). A single key cycles through them (`ViewToggleService.next()`).
- **Area download:**
  - The user draws a polygon and picks resolutions.
  - The download can be resumed, has a request limit and can optionally be packed into ZNM.

### Overlays
- **Waypoints:** labels and proximity circles. Circles are hidden below a configurable zoom level.
- **Clustering:** forced below a configurable zoom level. Each cluster is drawn as a donut showing the taken, ignored and remaining counts, plus the summed score of points not yet taken (`common/clusterGenerator.ts`).
- **Tracks** and **routes**. Routes are styled as current, next or dimmed.
- **Navigation line** from the GPS position to the active point.
- **GPS marker:** arrow or cross, with range rings and a course line.
- **Compass rose:** rotating (PRO).
- **Controls:** scale line, custom zoom-level bar, north-up button.

### Camera (`services/camera.ts`)
- Follow the GPS position, with course-up rotation.
- Zoom limits, and toggles for pinch-zoom and pinch-rotate.

## 6. Navigation and UI features

**Active route** (`services/routeService.ts` `processGpsPos`)
- Shows the distance to the active point.
- *Total remaining* = distance to the active point + straight lines between the remaining points. The legacy code ignored the guide lines here; use the leg distances instead.
- When the distance drops below the active waypoint's `proximity`, the route auto-advances. At the last point the legacy code stopped and reset to leg 0.
- Hotkeys: start, pause, stop, next and previous.

**Tripmeter** (`services/tripmeterService.ts`)
- Odometers 1 and 2, plus a hidden odometer 3 used for the average speed. Each has a CLR (reset).
- Distance accumulates from consecutive fixes.
- **Projection:**
  - The user enters a course (°) and a distance (m). The target is computed from the current position (destination point on the sphere), and a line is drawn from the vehicle to it.
  - Further projections can be queued.
  - Optionally, A/B waypoints are generated in the group "Zinc Projected Points".
- Fullscreen big-digit view.

**Point list / scoring** (`services/pointListService.ts`; its tab is disabled in the legacy UI)
- Sorted by state, then availability, then distance or value. Re-sorted at most once per second.
- When the vehicle enters a point's radius, its card expands with Take / Later / Unreachable. Optionally the point is taken automatically on entering the radius.
- Shows a countdown to each point's opening and closing time.

**Measure tool** (`measure/component.ts`)
- Polyline length plus the bearing of the last segment. Compute the bearing geodesically.

**Speed alarm**
- A global maximum speed with a selectable WAV sound. The speed readout turns red when it is exceeded.

**UI layout**
- **Main screen:**
  - Full-screen map.
  - Bottom bar: device status and satellite bars, a Routes or Odometer tab, and a speed/altitude/time card.
  - Right-hand action bar: zoom, centre, switch map, toggle toolbar, measure, clustering, Waypoints, Tracks, Routes, Export, Settings.
- **Settings:** Maps (tile sets, cache download, presets), GPS devices, Camera, Hotkeys, Common, Access key.
- **Coordinate entry** (`common/coordinates/dialog.ts`):
  - On-screen keypad.
  - Three formats: `hddd°mm′ss.s″`, `hddd°mm.mmm′`, `hddd.dddddd°`.
  - "Create next" lets the user enter waypoints one after another quickly.
- **Hotkeys:** every action can be bound, so the app can be used from the keyboard alone in the cockpit.

## 7. Import, export and interop

**Import**
- Waypoints: Ozi `.wpt` (encoding detected) and `.gpx`.
- Tracks: Ozi `.plt` (OLE automation dates) and `.gpx`.

**GPX** (streaming parser)
- Elements: `wpt`, `trk`, `rte`.
- Garmin `wptx1:Proximity`.
- Zinc extensions: `zinc:wpt`, `zinc:track`, `zinc:route`, `zinc:rtept`, `zinc:rtelines`.

**GPX export** (`services/workers/gpxBuilder.ts`)
- Option: "compatibility mode", which leaves out the zinc extensions.
- Option: rename route points in order.
- Option: export routes as tracks.

**Bluetooth companion protocol** (`services/bt.service.ts`)
- RFCOMM UUID `3afaa9ff-faa8-4671-b70f-20c96dee735b`.
- Newline-delimited JSON messages of the form `{command, id, data}`. Each packet waits for a reply with the same `id`.
- Commands: `createWptGroup`, `createWpts`, `createTrack`, `createTrackPoints`, `createRoute`, `createRoutePoint`, `createRouteGuidePt`, `createRouteNotification`.
- The receiver is probably an Android companion app.

## 8. Legacy communication patterns (for context only; do not reproduce)

**UI ↔ DB worker**
- `DbService.sendWorkerMessage` sends JSON `WorkerMessage {msgId, msgType, command, table, data}` messages (`services/workers/workerMessage.ts`).
- The UI layer builds the raw SQL strings (`init`, `RUN`, `INSERT`, `GET`, `GETONE`).
- The same channel carries tile, ZNM and GPX-export commands.
- Replies are correlated by GUID, with streaming `next`/`complete` messages.

**In-process**
- Angular `EventEmitter` buses on each service, plus manual `ChangeDetectorRef.detectChanges()`.

**Active record**
- Every model setter fires `UPDATE <Table> SET ${property} = ?` without waiting for the result.

**Other**
- Splash ↔ main window: `window.postMessage`.
- External: plain HTTP to zeiza.eu (updates, activation) and to tile servers.

## 9. Known legacy bugs (do not reproduce)

- The `odo2`/`odo3` getters return `_odo1` (`tripmeterService.ts`, around lines 180 and 202).
- GPX export writes `zinc:*` elements without declaring `xmlns:zinc`.
- Some waypoint coordinate setters call `parseInt`, which truncates coordinates (`waypoint.ts`, around lines 132–150).
- Bearings (GPS course, measure tool) are computed with atan2 on Mercator coordinates.
- Total remaining distance ignores the guide lines.
- Garmin addon defects:
  - It polls with blocking reads every 50 ms.
  - It leaks memory.
  - `SendCommandPacket` uses `gHandle` instead of `gHandle[dev]`.
  - `sendPacketToDevice` passes `sizeof(info[0])` as the write length.
- Navigation state is split between `localStorage` and SQLite.
- Schema changes are ad-hoc `ALTER TABLE` checks, with no migrations.

## 10. Half-finished in legacy

- Route leg notifications: stored and synced over Bluetooth, but never triggered.
- Point-list tab: commented out.
- Map presets: the persistence store was removed while the model still calls `db.update`.
- `garmin.worker.libusb.ts`: an unused alternative implementation.
- `TrackRendererService`: an empty stub.
- `lt.json`: empty translation file.

## 11. Not in legacy (candidates for new features)

Roadbook, CAP heading-to-waypoint display, cross-track error (XTE), ETA, speed zones / DSS–WPM, and per-segment speed limits. The legacy app has only one global over-speed alarm.

## 12. Licensing (awareness only; do not port)

- Levels: 0 = no key, 1 = regular, 2 = PRO (time-limited), 3 = developer machine whitelist (`services/accessService.ts`).
- PRO features include Bluetooth GPS, projections, the fullscreen odometer and the compass rose. `extraProj` unlocks projected waypoint generation.
- The implementation uses hardcoded AES passphrases, plain-HTTP activation and `process.exit` in SDK builds. Any new licensing needs a fresh design.

## 13. Glossary (EN / RU / LV)

| Term | RU | LV | Meaning |
|---|---|---|---|
| Navigator | штурман | stūrmanis | The co-driver; the primary user |
| Proximity / active radius | Активный радиус | Aktīvais rādiuss | The radius around a point that counts as reaching it; drives auto-advance and taking a point |
| Value / score | Баллы | Vērtība | A control point's score (trophy / rogaining-style scoring) |
| Taken / Later / Unreachable | Взято / Позже / Недостижимо | Paņemts / Vēlāk / Neņemams | The navigator's decision on a point (states 3 / 1 / 4) |
| Availability time | Время доступности точки | Pieejamības laiks | The time window when a point is open |
| Odometer, CLR | Одометр | Odometrs | Rally tripmeter readings and reset |
| Projection | Проецировать | Projecēt | Plot a point by course and distance from the current position ("azimuth + distance" legend tasks) |
| Course | Курс | Kurss | Bearing in degrees |
| Route leg / guide lines | | | One route step and its alternative guide polylines (`zinc:rtelines`) |
| Range rings / course line / pointer | | | Overlays on the vehicle marker |
| Preset | | | A saved stack of map layers |
| SAS / SASPlanet | | | Tile cache layout of the SAS.Planet tool |
| ZNM / ZNC | | | Zinc SQLite tile container / Zinc JSON map configuration |
| PVT | | | Garmin Position-Velocity-Time packet |
| HNR-PVT | | | u-blox High Navigation Rate PVT message |
| PIOW | | | Custom NMEA sentence for pushing a waypoint from a device |
