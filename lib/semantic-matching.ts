// Semantic matching utilities for task classification

interface TareaData {
  id: string
  rubro_id: string
  nombre: string
  descripcion?: string | null
  aliases?: string[]
  keywords?: string[]
  ejemplos?: string[]
}

interface RubroData {
  id: string
  nombre: string
}

interface MatchResult {
  tarea: TareaData
  rubro: RubroData | undefined
  score: number
  matchType: 'exact' | 'alias' | 'keyword' | 'ejemplo' | 'fuzzy'
}

// Normalize text for comparison
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .trim()
}

// Calculate similarity between two strings (simple Jaccard-like)
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(normalize(text1).split(/\s+/).filter(w => w.length > 2))
  const words2 = new Set(normalize(text2).split(/\s+/).filter(w => w.length > 2))
  
  if (words1.size === 0 || words2.size === 0) return 0
  
  const intersection = [...words1].filter(w => words2.has(w)).length
  const union = new Set([...words1, ...words2]).size
  
  return intersection / union
}

// Check if text contains a phrase (partial match)
function containsPhrase(text: string, phrase: string): boolean {
  return normalize(text).includes(normalize(phrase))
}

// Main semantic matching function
export function findBestMatch(
  userText: string,
  tareas: TareaData[],
  rubros: RubroData[]
): MatchResult[] {
  const normalizedInput = normalize(userText)
  const results: MatchResult[] = []

  for (const tarea of tareas) {
    const rubro = rubros.find(r => r.id === tarea.rubro_id)
    let bestScore = 0
    let matchType: MatchResult['matchType'] = 'fuzzy'

    // 1. Exact name match (highest priority)
    if (containsPhrase(userText, tarea.nombre)) {
      bestScore = 1.0
      matchType = 'exact'
    }

    // 2. Alias match
    if (bestScore < 0.95 && tarea.aliases) {
      for (const alias of tarea.aliases) {
        if (containsPhrase(userText, alias)) {
          const aliasScore = 0.95
          if (aliasScore > bestScore) {
            bestScore = aliasScore
            matchType = 'alias'
          }
        }
      }
    }

    // 3. Ejemplo match (user text similar to example)
    if (bestScore < 0.90 && tarea.ejemplos) {
      for (const ejemplo of tarea.ejemplos) {
        const similarity = calculateSimilarity(userText, ejemplo)
        const ejemploScore = 0.85 + (similarity * 0.10) // 0.85-0.95 range
        if (ejemploScore > bestScore && similarity > 0.3) {
          bestScore = ejemploScore
          matchType = 'ejemplo'
        }
      }
    }

    // 4. Keyword match
    if (bestScore < 0.80 && tarea.keywords) {
      const matchedKeywords = tarea.keywords.filter(kw => 
        containsPhrase(userText, kw)
      )
      if (matchedKeywords.length > 0) {
        // More keywords matched = higher score
        const keywordScore = 0.60 + (Math.min(matchedKeywords.length, 3) * 0.10)
        if (keywordScore > bestScore) {
          bestScore = keywordScore
          matchType = 'keyword'
        }
      }
    }

    // 5. Fuzzy match on name and description
    if (bestScore < 0.60) {
      const nameSimilarity = calculateSimilarity(userText, tarea.nombre)
      const descSimilarity = tarea.descripcion 
        ? calculateSimilarity(userText, tarea.descripcion)
        : 0
      const fuzzyScore = Math.max(nameSimilarity, descSimilarity) * 0.60
      if (fuzzyScore > bestScore) {
        bestScore = fuzzyScore
        matchType = 'fuzzy'
      }
    }

    if (bestScore > 0.1) {
      results.push({ tarea, rubro, score: bestScore, matchType })
    }
  }

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score)
}

// Determine action based on match results
export function getMatchDecision(matches: MatchResult[]): {
  action: 'auto_save' | 'confirm' | 'clarify'
  topMatch: MatchResult | null
  alternatives: MatchResult[]
  message: string
} {
  if (matches.length === 0) {
    return {
      action: 'clarify',
      topMatch: null,
      alternatives: [],
      message: 'No encontré ninguna tarea relacionada.'
    }
  }

  const topMatch = matches[0]
  const alternatives = matches.slice(1, 4).filter(m => m.score > 0.5)

  // High confidence - auto save
  if (topMatch.score >= 0.85) {
    return {
      action: 'auto_save',
      topMatch,
      alternatives,
      message: `Clasificado como "${topMatch.tarea.nombre}" (${topMatch.rubro?.nombre || 'Sin rubro'})`
    }
  }

  // Medium confidence - ask for confirmation
  if (topMatch.score >= 0.60) {
    return {
      action: 'confirm',
      topMatch,
      alternatives,
      message: `¿Se refiere a "${topMatch.tarea.nombre}" en ${topMatch.rubro?.nombre || 'Sin rubro'}?`
    }
  }

  // Low confidence - need clarification
  return {
    action: 'clarify',
    topMatch,
    alternatives: matches.slice(0, 4),
    message: 'No estoy seguro a qué tarea se refiere.'
  }
}
