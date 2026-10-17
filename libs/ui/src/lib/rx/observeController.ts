import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { Observable, Subscription } from 'rxjs';

/** Subscribes while the host is connected and re-renders it on every value. */
export class ObserveController<T> implements ReactiveController {
  value: T;

  private subscription?: Subscription;

  constructor(
    private readonly host: ReactiveControllerHost,
    private readonly source: Observable<T>,
    initial: T,
  ) {
    this.value = initial;
    host.addController(this);
  }

  hostConnected(): void {
    this.subscription ??= this.source.subscribe((value) => {
      this.value = value;
      this.host.requestUpdate();
    });
  }

  hostDisconnected(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
  }
}
