import { useState, useEffect } from 'react';

export interface DictionaryDefinition {
  definition: string;
  example?: string;
  synonyms: string[];
  antonyms: string[];
}

export interface DictionaryMeaning {
  partOfSpeech: string;
  definitions: DictionaryDefinition[];
}

export interface DictionaryData {
  word: string;
  phonetic: string;
  audio: string;
  origin: string;
  meanings: DictionaryMeaning[];
}

interface UseDictionaryResult {
  data: DictionaryData | null;
  loading: boolean;
  error: string | null;
}

export function useDictionary(word: string | null): UseDictionaryResult {
  const [data, setData] = useState<DictionaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!word) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    
    const fetchDictionary = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/dictionary/${encodeURIComponent(word)}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Word not found in dictionary');
          }
          throw new Error('Failed to fetch dictionary data');
        }
        
        const result = await response.json();
        
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error occurred');
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchDictionary();

    return () => {
      cancelled = true;
    };
  }, [word]);

  return { data, loading, error };
}

// Utility function to get the primary definition for a word
export function getPrimaryDefinition(data: DictionaryData | null): string {
  if (!data || !data.meanings.length) return '';
  
  const firstMeaning = data.meanings[0];
  if (!firstMeaning.definitions.length) return '';
  
  return firstMeaning.definitions[0].definition;
}

// Utility function to get all definitions formatted for display
export function getFormattedDefinitions(data: DictionaryData | null): Array<{
  partOfSpeech: string;
  definition: string;
  example?: string;
}> {
  if (!data) return [];
  
  return data.meanings.flatMap(meaning =>
    meaning.definitions.map(def => ({
      partOfSpeech: meaning.partOfSpeech,
      definition: def.definition,
      example: def.example
    }))
  );
}
