import { v5 as uuidv5 } from "uuid";

// Fixed namespace UUID for deterministic sense IDs
// You can regenerate if desired, but keep it stable across environments.
export const SENSE_NAMESPACE = "90a22e9e-2f87-4f2c-8a1e-3a2b1a0c8f7b";

export function computeSenseId(word: string, pos: string, definition: string): string {
  const key = `${word}::${pos}::${definition.trim()}`;
  return uuidv5(key, SENSE_NAMESPACE);
}
