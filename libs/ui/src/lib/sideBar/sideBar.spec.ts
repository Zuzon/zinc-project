import '@material/web/iconbutton/icon-button.js';
import { BehaviorSubject, of } from 'rxjs';
import { type Ctx, getCtx, setCtx } from '@zinc-project/ui-state';
import './sideBar.js';
import type { SideBar } from './sideBar.js';

const ACTIONS = [
  'zoom-in',
  'zoom-out',
  'cycle-map',
  'waypoints',
  'tracks',
  'routes',
  'menu',
];

describe('SideBar', () => {
  let defaultCtx: Ctx;
  let canCycleMap$: BehaviorSubject<boolean>;
  let cycleMap: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    defaultCtx = getCtx();
    canCycleMap$ = new BehaviorSubject(false);
    cycleMap = vi.fn(() => of(undefined));
    setCtx({
      ...defaultCtx,
      mapLayers: { ...defaultCtx.mapLayers, canCycleMap$, cycleMap },
    } as Ctx);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    setCtx(defaultCtx);
  });

  async function render(): Promise<SideBar> {
    const bar = document.createElement('side-bar');
    document.body.append(bar);
    await bar.updateComplete;
    return bar;
  }

  const buttons = (bar: SideBar) => [
    ...(bar.shadowRoot?.querySelectorAll('md-icon-button') ?? []),
  ];

  const action = (bar: SideBar, id: string) =>
    buttons(bar).find((b) => b.dataset['action'] === id);

  it('lists the actions from top to bottom', async () => {
    const bar = await render();

    expect(buttons(bar).map((b) => b.dataset['action'])).toEqual(ACTIONS);
  });

  it('keeps not yet implemented actions disabled', async () => {
    const bar = await render();

    const disabled = buttons(bar)
      .filter((b) => b.disabled)
      .map((b) => b.dataset['action']);
    expect(disabled).toEqual(
      expect.arrayContaining(['waypoints', 'tracks', 'routes', 'menu']),
    );
    expect(action(bar, 'zoom-in')?.disabled).toBe(false);
    expect(action(bar, 'zoom-out')?.disabled).toBe(false);
  });

  it('enables map switching only when the worker allows it', async () => {
    const bar = await render();
    expect(action(bar, 'cycle-map')?.disabled).toBe(true);

    canCycleMap$.next(true);
    await bar.updateComplete;
    expect(action(bar, 'cycle-map')?.disabled).toBe(false);

    action(bar, 'cycle-map')?.click();
    expect(cycleMap).toHaveBeenCalledOnce();
  });

  it('requests zoom changes from the map view', async () => {
    const bar = await render();
    const deltas: number[] = [];
    document.body.addEventListener('map-zoom', (e) => deltas.push(e.detail));

    action(bar, 'zoom-in')?.click();
    action(bar, 'zoom-out')?.click();

    expect(deltas).toEqual([1, -1]);
  });
});
