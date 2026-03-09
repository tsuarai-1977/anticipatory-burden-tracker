import { get, set, createStore } from 'idb-keyval';

const store = createStore('ab-tracker-db', 'ab-tracker-store');

export async function loadEntries() {
  return (await get('entries', store)) || [];
}

export async function saveEntries(entries) {
  await set('entries', entries, store);
}

export async function loadPastMemories() {
  return (await get('pastMemories', store)) || [];
}

export async function savePastMemories(memories) {
  await set('pastMemories', memories, store);
}
