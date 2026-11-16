// Keyword rules: "if the note or slip mentions X, put it in category Y".
// Pure logic, no database or screen code.

export interface Rule {
  id: string
  keyword: string
  category_id: string
}

// Case-insensitive "contains" match. When several keywords match, the longest
// (most specific) one wins.
export function matchCategory(text: string, rules: Rule[]): string | null {
  const haystack = text.toLowerCase()
  let best: Rule | null = null
  for (const rule of rules) {
    const keyword = rule.keyword.trim().toLowerCase()
    if (keyword && haystack.includes(keyword) && (!best || keyword.length > best.keyword.trim().length)) best = rule
  }
  return best ? best.category_id : null
}
