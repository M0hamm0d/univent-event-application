import { openDB } from 'idb'

const DB_NAME = 'univent-db'
const DB_VERSION = 1

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('events')) {
      db.createObjectStore('events', {
        keyPath: 'id',
      })
    }

    if (!db.objectStoreNames.contains('metadata')) {
      db.createObjectStore('metadata')
    }
  },
})

export async function saveEvents(events) {
  const db = await dbPromise
  const tx = db.transaction('events', 'readwrite')

  await Promise.all([
    ...events.map((event) => tx.store.put(event)),
    tx.done,
  ])
}

export async function getEvents() {
  const db = await dbPromise

  return db.getAll('events')
}

export async function clearEvents() {
  const db = await dbPromise

  await db.clear('events')
}

export async function setLastSync(date = new Date().toISOString()) {
  const db = await dbPromise

  await db.put('metadata', date, 'events-last-sync')
}

export async function getLastSync() {
  const db = await dbPromise

  return db.get('metadata', 'events-last-sync')
}
