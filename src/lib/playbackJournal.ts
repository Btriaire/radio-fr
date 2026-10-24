const KEY = "radiofr_journal";
const MAX = 200;

export interface JournalEntry { t: string; e: string; d?: string }

export function journal(e: string, d?: string) {
  try {
    const list: JournalEntry[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    list.push({ t: new Date().toISOString(), e, d });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {}
}

export function readJournal(): JournalEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export function clearJournal() {
  try { localStorage.removeItem(KEY); } catch {}
}
