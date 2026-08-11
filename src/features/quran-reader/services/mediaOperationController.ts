export interface MediaOperation {
  id: number;
  signal: AbortSignal;
}

/** Owns one current media operation and invalidates every stale completion. */
export class MediaOperationController {
  private nextId = 0;
  private abortController: AbortController | null = null;

  begin(): MediaOperation {
    this.abortController?.abort();
    this.abortController = new AbortController();
    this.nextId += 1;
    return { id: this.nextId, signal: this.abortController.signal };
  }

  cancel(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.nextId += 1;
  }

  isCurrent(operation: MediaOperation): boolean {
    return operation.id === this.nextId && !operation.signal.aborted;
  }
}
