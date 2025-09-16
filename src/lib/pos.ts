export function posLabel(abbrev: string): string {
  switch (abbrev) {
    case "v":
      return "verb";
    case "n":
      return "noun";
    case "adj":
      return "adjective";
    case "adv":
      return "adverb";
    case "prep":
      return "preposition";
    case "conj":
      return "conjunction";
    case "pron":
      return "pronoun";
    case "interj":
      return "interjection";
    default:
      return abbrev;
  }
}
