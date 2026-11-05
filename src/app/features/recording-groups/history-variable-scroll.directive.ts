import { Directive, forwardRef, Input } from '@angular/core';
import {
  CdkVirtualScrollViewport, VirtualScrollStrategy, VIRTUAL_SCROLL_STRATEGY,
} from '@angular/cdk/scrolling';
import { Subject } from 'rxjs';
import {
  HistoryDisplayRow, historyIndexAtOffset, historyRowOffsets,
} from './history-display-rows';

/**
 * Pixel-accurate, variable-height virtualization for 80px contacts,
 * 48px children and independent detail/player rows. All heights are
 * known from the projection before rendering; no measurement guesswork.
 */
export class HistoryVariableScrollStrategy implements VirtualScrollStrategy {
  readonly scrolledIndexChange = new Subject<number>();
  private viewport?: CdkVirtualScrollViewport;
  private rows: readonly HistoryDisplayRow[] = [];
  private offsets: number[] = [0];
  private readonly bufferPx = 600;

  attach(viewport: CdkVirtualScrollViewport): void {
    this.viewport = viewport;
    this.refresh();
  }
  detach(): void {
    this.viewport = undefined;
  }
  setRows(rows: readonly HistoryDisplayRow[]): void {
    this.rows = rows;
    this.offsets = historyRowOffsets(rows);
    this.refresh();
  }
  onContentScrolled(): void { this.render(); }
  onDataLengthChanged(): void { this.refresh(); }
  onContentRendered(): void { /* Exact sizes are declared per row. */ }
  onRenderedOffsetChanged(): void { /* No dynamic offset correction needed. */ }
  scrollToIndex(index: number, behavior: ScrollBehavior = 'auto'): void {
    this.viewport?.scrollToOffset(this.offsets[Math.max(0, Math.min(index, this.rows.length))] ?? 0, behavior);
  }
  checkViewport(): void {
    this.refresh();
  }
  private refresh(): void {
    this.viewport?.setTotalContentSize(this.offsets[this.offsets.length - 1]);
    this.render();
  }
  private render(): void {
    const viewport = this.viewport;
    if (!viewport) return;
    const len = this.rows.length;
    if (!len) {
      viewport.setRenderedRange({ start: 0, end: 0 });
      viewport.setRenderedContentOffset(0);
      this.scrolledIndexChange.next(0);
      return;
    }
    const top = Math.max(0, viewport.measureScrollOffset('top'));
    const visibleHeight = Math.max(0, viewport.getViewportSize());
    const start = historyIndexAtOffset(this.offsets, Math.max(0, top - this.bufferPx));
    const end = Math.min(len, historyIndexAtOffset(this.offsets, top + visibleHeight + this.bufferPx) + 1);
    const current = viewport.getRenderedRange();
    if (current.start !== start || current.end !== end) {
      viewport.setRenderedRange({ start, end });
    }
    viewport.setRenderedContentOffset(this.offsets[start]);
    this.scrolledIndexChange.next(historyIndexAtOffset(this.offsets, top));
  }
}

@Directive({
  selector: 'cdk-virtual-scroll-viewport[historyVariableScroll]',
  standalone: true,
  providers: [{
    provide: VIRTUAL_SCROLL_STRATEGY,
    useFactory: (directive: HistoryVariableScrollDirective) => directive.strategy,
    deps: [forwardRef(() => HistoryVariableScrollDirective)],
  }],
})
export class HistoryVariableScrollDirective {
  readonly strategy = new HistoryVariableScrollStrategy();

  @Input({ alias: 'historyVariableScroll', required: true })
  set displayRows(rows: readonly HistoryDisplayRow[]) {
    this.strategy.setRows(rows);
  }
}
