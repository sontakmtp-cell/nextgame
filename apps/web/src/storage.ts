import type { DraftBot, RevisionRecord, ExperimentRunResult } from './types.js';
import { MANTIS_BOT, PRESET_BEHAVIOR_CARDS } from './presets.js';

const DB_NAME = 'prompt_chien_drafts_v1';
const DB_VERSION = 1;

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;
const memoryDrafts = new Map<string, DraftBot>();
const memoryRevisions: RevisionRecord[] = [];
const memoryExperiments: ExperimentRunResult[] = [];

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not supported'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('revisions')) {
          const revStore = db.createObjectStore('revisions', { keyPath: ['draftId', 'revision'] });
          revStore.createIndex('by_draft', 'draftId', { unique: false });
        }
        if (!db.objectStoreNames.contains('experiments')) {
          db.createObjectStore('experiments', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

export async function listDrafts(): Promise<DraftBot[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', 'readonly');
      const store = tx.objectStore('drafts');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as DraftBot[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [...memoryDrafts.values()];
  }
}

export async function getDraft(id: string): Promise<DraftBot | undefined> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', 'readonly');
      const store = tx.objectStore('drafts');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result as DraftBot | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return memoryDrafts.get(id);
  }
}

export async function saveDraft(draft: DraftBot, expectedRevision?: number): Promise<DraftBot> {
  const existing = await getDraft(draft.id);
  if (existing && expectedRevision !== undefined && existing.revision !== expectedRevision) {
    throw new ConflictError(
      `Xung đột phiên bản (409): Nháp đã được chỉnh sửa ở phiên khác (hiện tại: v${existing.revision}, mong đợi: v${expectedRevision}). Vui lòng tải lại trước khi ghi đè.`
    );
  }

  const updated: DraftBot = {
    ...draft,
    revision: (existing ? existing.revision : 0) + 1,
    updatedAt: new Date().toISOString(),
    isUnofficial: true,
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      const store = tx.objectStore('drafts');
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryDrafts.set(updated.id, updated);
  }

  return updated;
}

export async function createDraft(
  name: string,
  initialDefinition = MANTIS_BOT,
  behaviorCard = PRESET_BEHAVIOR_CARDS.Mantis!
): Promise<DraftBot> {
  const newDraft: DraftBot = {
    id: `synth-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name,
    revision: 1,
    updatedAt: new Date().toISOString(),
    definition: { ...initialDefinition, name },
    behaviorCard,
    isUnofficial: true,
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      const store = tx.objectStore('drafts');
      const req = store.add(newDraft);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryDrafts.set(newDraft.id, newDraft);
  }

  return newDraft;
}

export async function freezeRevision(
  draft: DraftBot,
  summary: string
): Promise<RevisionRecord> {
  // First save updated draft with CAS
  const saved = await saveDraft({
    ...draft,
    parentRevision: draft.revision,
  }, draft.revision);

  const record: RevisionRecord = {
    draftId: saved.id,
    revision: saved.revision,
    timestamp: new Date().toISOString(),
    definition: structuredClone(saved.definition),
    behaviorCard: structuredClone(saved.behaviorCard),
    summary,
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('revisions', 'readwrite');
      const store = tx.objectStore('revisions');
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryRevisions.push(record);
  }

  return record;
}

export async function getRevisions(draftId: string): Promise<RevisionRecord[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('revisions', 'readonly');
      const store = tx.objectStore('revisions');
      const index = store.index('by_draft');
      const req = index.getAll(draftId);
      req.onsuccess = () => resolve((req.result as RevisionRecord[]).sort((a, b) => b.revision - a.revision));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return memoryRevisions.filter(r => r.draftId === draftId).sort((a, b) => b.revision - a.revision);
  }
}

export async function saveExperiment(experiment: ExperimentRunResult): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('experiments', 'readwrite');
      const store = tx.objectStore('experiments');
      const req = store.put(experiment);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryExperiments.push(experiment);
  }
}

export async function getExperiments(draftId?: string): Promise<ExperimentRunResult[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('experiments', 'readonly');
      const store = tx.objectStore('experiments');
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result as ExperimentRunResult[];
        resolve(draftId ? all.filter(e => e.draftId === draftId) : all);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return draftId ? memoryExperiments.filter(e => e.draftId === draftId) : [...memoryExperiments];
  }
}
