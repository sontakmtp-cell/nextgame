import type { BotDefinition } from '@prompt-chien/contracts';
import type {
  ExperimentRunResult,
  SimulationPayload,
  WorkerRequest,
  WorkerResponse,
} from './types.js';

type ResponseHandler = (res: WorkerResponse) => void;

class WorkerBridge {
  private worker: Worker | null = null;
  private handlers = new Map<string, ResponseHandler>();
  private progressCallbacks = new Map<string, (done: number, total: number) => void>();
  private lastWorkerCrashMessage: string | null = null;

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof Worker === 'undefined') return;
    try {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const res = e.data;
        if (res.type === 'experiment_progress') {
          const cb = this.progressCallbacks.get(res.id);
          if (cb) cb(res.current, res.total);
          return;
        }

        const handler = this.handlers.get(res.id);
        if (handler) {
          this.handlers.delete(res.id);
          this.progressCallbacks.delete(res.id);
          handler(res);
        }
      };

      this.worker.onerror = (err: ErrorEvent) => {
        const errorMsg = err.message || 'Worker crash không xác định';
        this.lastWorkerCrashMessage = errorMsg;
        // Reject all pending requests
        for (const [id, handler] of this.handlers.entries()) {
          handler({
            id,
            type: 'worker_error',
            message: `Worker gặp sự cố: ${errorMsg}. Đã khởi động lại Worker để bạn có thể thử lại ngay.`,
          });
        }
        this.handlers.clear();
        this.progressCallbacks.clear();

        // Re-spawn fresh worker
        this.worker?.terminate();
        this.worker = null;
        setTimeout(() => this.initWorker(), 50);
      };
    } catch (err) {
      this.lastWorkerCrashMessage = String(err);
    }
  }

  public getCrashStatus(): string | null {
    return this.lastWorkerCrashMessage;
  }

  public clearCrashStatus(): void {
    this.lastWorkerCrashMessage = null;
  }

  public async validateBot(bot: BotDefinition): Promise<{ valid: boolean; packageHash?: string | undefined; error?: string | undefined; pointer?: string | undefined }> {
    const id = `val-${Date.now()}-${Math.random()}`;
    return new Promise(resolve => {
      this.handlers.set(id, res => {
        if (res.type === 'validate_success') {
          resolve({ valid: true, packageHash: res.packageHash });
        } else if (res.type === 'validate_error') {
          resolve({ valid: false, error: res.error, pointer: res.pointer });
        } else if (res.type === 'worker_error') {
          resolve({ valid: false, error: res.message });
        } else {
          resolve({ valid: false, error: 'Phản hồi không xác định' });
        }
      });
      this.send({ id, type: 'validate', bot });
    });
  }

  public async simulateMatch(
    botA: BotDefinition,
    botB: BotDefinition,
    seed?: string | undefined,
    swapped?: boolean | undefined
  ): Promise<SimulationPayload> {
    const id = `sim-${Date.now()}-${Math.random()}`;
    return new Promise((resolve, reject) => {
      this.handlers.set(id, res => {
        if (res.type === 'simulate_success') {
          resolve(res.data);
        } else if (res.type === 'worker_error') {
          reject(new Error(res.message));
        } else {
          reject(new Error('Mô phỏng thất bại'));
        }
      });
      this.send({ id, type: 'simulate', botA, botB, seed, swapped });
    });
  }

  public async runExperiment(
    baseline: BotDefinition,
    candidate: BotDefinition,
    opponent: BotDefinition,
    scenarioCount: number,
    onProgress?: (done: number, total: number) => void
  ): Promise<ExperimentRunResult> {
    const id = `exp-${Date.now()}-${Math.random()}`;
    if (onProgress) {
      this.progressCallbacks.set(id, onProgress);
    }
    return new Promise((resolve, reject) => {
      this.handlers.set(id, res => {
        if (res.type === 'experiment_success') {
          resolve(res.data);
        } else if (res.type === 'worker_error') {
          reject(new Error(res.message));
        } else {
          reject(new Error('Thí nghiệm thất bại'));
        }
      });
      this.send({ id, type: 'experiment', baseline, candidate, opponent, scenarioCount });
    });
  }

  public cancel(id: string): void {
    if (this.handlers.has(id)) {
      this.handlers.delete(id);
      this.progressCallbacks.delete(id);
    }
    this.worker?.terminate();
    this.worker = null;
    this.initWorker();
  }

  private send(req: WorkerRequest): void {
    if (!this.worker) this.initWorker();
    if (!this.worker) {
      const handler = this.handlers.get(req.id);
      if (handler) {
        this.handlers.delete(req.id);
        handler({ id: req.id, type: 'worker_error', message: 'Worker không khả dụng' });
      }
      return;
    }
    this.worker.postMessage(req);
  }
}

export const workerBridge = new WorkerBridge();
