
@Component({
  selector: "app-control-flow",
  template: `
    @if (ready) {
      <button id="ready-btn">Ready</button>
    } @else {
      <button id="not-ready">Not ready</button>
    }
    @for (item of items; track item.id) {
      <span>{{ item.name }}</span>
    } @empty {
      <span>No items</span>
    }
    @switch (status) {
      @case ('ok') { <span>OK</span> }
      @default { <span>Unknown</span> }
    }
    @defer {
      <button id="defer-btn">Deferred</button>
    } @placeholder {
      <span>Loading placeholder</span>
    }
  `,
})
export class ControlFlowComponent {}
