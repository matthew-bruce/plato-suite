// Best-guess discipline for a role title, for the Assign resource wizard's
// "add as new person" path.
//
// There is no role-title → discipline mapping table: role titles are free text
// typed per allocation ("Engineer - Platform / DevOps", "Front End (React)
// Engineer"), while disciplines are a fixed list of ~27 names. So the guess is
// a text match, and it is only ever a SUGGESTION — the wizard always shows it
// as an editable dropdown, and this function returns null rather than offering
// a bad guess.
//
// Scoring is self-calibrating against the discipline list itself: a token that
// appears in many discipline names ("engineering", "management") carries less
// weight than one that appears in a single name ("platform", "devops"), the
// same idea as IDF. That is what makes "Engineer - Platform / DevOps" land on
// "Platform & DevOps" rather than on one of the seven "… Engineering" names.

export interface DisciplineOption {
  discipline_id: string
  discipline_name: string
}

export interface DisciplineMatch {
  disciplineId: string
  disciplineName: string
  /** Summed weight of the matched tokens — higher is a stronger match. */
  score: number
  /** Share of the discipline's own token weight that the role title matched. */
  coverage: number
}

/** Words that carry no signal about which discipline is meant. */
const STOPWORDS = new Set([
  'and', 'or', 'of', 'the', 'a', 'an', 'for', 'to', 'with',
  // Seniority and role-shape words that appear across every discipline.
  'senior', 'junior', 'lead', 'principal', 'head', 'chief', 'staff',
  'associate', 'assistant', 'deputy', 'trainee', 'graduate', 'apprentice',
  'contractor', 'consultant', 'specialist', 'officer', 'owner', 'manager',
  'technical', 'technology', 'digital', 'team',
])

/**
 * Light stem so "Engineering" matches "Engineer" and "Operations" matches
 * "Operation". Deliberately crude — both sides go through the same function,
 * so it only has to be consistent, not linguistically correct.
 */
function stem(token: string): string {
  let t = token
  if (t.length > 5 && t.endsWith('ing')) t = t.slice(0, -3)
  if (t.length > 4 && t.endsWith('ers')) t = t.slice(0, -1)
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1)
  return t
}

/**
 * Split free text into comparable tokens. Adjacent pairs are also emitted
 * joined together, so "Front End" produces "frontend" and matches the
 * discipline "Frontend Engineering" — the single most common way these role
 * titles differ from the canonical names.
 */
export function tokenise(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0)

  const out = new Set<string>()
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (!STOPWORDS.has(w)) out.add(stem(w))
    // Joined adjacent pair: "front" + "end" → "frontend". Skipped when either
    // half is a stopword, so "Senior Lead" cannot smuggle in "seniorlead".
    if (i + 1 < words.length) {
      const next = words[i + 1]
      if (!STOPWORDS.has(w) && !STOPWORDS.has(next)) out.add(stem(w + next))
    }
  }
  return out
}

/** Shortest shared prefix that counts two tokens as the same word. */
const MIN_PREFIX = 5

/**
 * Whether a discipline token is present in the role title's tokens, allowing
 * for the agent-noun forms these titles are full of: Architect/Architecture,
 * Designer/Design, Scientist/Science, Manager/Management. A shared prefix of
 * MIN_PREFIX characters is enough — short enough to catch those pairs, long
 * enough that "product"/"programme" (3) stays a non-match.
 */
function tokenMatches(token: string, roleTokens: Set<string>): boolean {
  if (roleTokens.has(token)) return true
  for (const rt of roleTokens) {
    const shortest = Math.min(rt.length, token.length)
    if (shortest < MIN_PREFIX) continue
    if (rt.slice(0, MIN_PREFIX) === token.slice(0, MIN_PREFIX)) return true
  }
  return false
}

/** Token → how many disciplines contain it, used to down-weight common words. */
function documentFrequencies(disciplines: DisciplineOption[]): Map<string, number> {
  const df = new Map<string, number>()
  for (const d of disciplines) {
    for (const t of tokenise(d.discipline_name)) {
      df.set(t, (df.get(t) ?? 0) + 1)
    }
  }
  return df
}

/** Rarer tokens weigh more. A token absent from every name still counts. */
function weightOf(token: string, df: Map<string, number>, total: number): number {
  const freq = df.get(token) ?? 0
  if (freq <= 0) return Math.log(total + 1)
  return Math.log(total / freq) + 0.1
}

/** A match must clear both bars, or no suggestion is offered at all. */
const MIN_SCORE = 0.8
const MIN_COVERAGE = 0.35

/**
 * Suggest the discipline a role title most likely belongs to.
 *
 * Returns null when nothing matches well enough, and also when the top two
 * candidates are indistinguishable — an arbitrary pick between equals is
 * exactly the "guessing badly" case the caller wants avoided.
 */
export function suggestDiscipline(
  roleTitle: string | null | undefined,
  disciplines: DisciplineOption[],
): DisciplineMatch | null {
  if (!roleTitle || disciplines.length === 0) return null

  const roleTokens = tokenise(roleTitle)
  if (roleTokens.size === 0) return null

  const df = documentFrequencies(disciplines)
  const total = disciplines.length

  const scored: DisciplineMatch[] = disciplines.map((d) => {
    const discTokens = tokenise(d.discipline_name)
    let matched = 0
    let totalWeight = 0
    for (const t of discTokens) {
      const w = weightOf(t, df, total)
      totalWeight += w
      if (tokenMatches(t, roleTokens)) matched += w
    }
    return {
      disciplineId: d.discipline_id,
      disciplineName: d.discipline_name,
      score: matched,
      coverage: totalWeight > 0 ? matched / totalWeight : 0,
    }
  })

  scored.sort((a, b) => (b.score - a.score) || (b.coverage - a.coverage))

  const best = scored[0]
  if (!best || best.score < MIN_SCORE || best.coverage < MIN_COVERAGE) return null

  // Two candidates that score identically on both measures are a genuine tie:
  // offer neither rather than whichever happened to sort first.
  const runnerUp = scored[1]
  if (
    runnerUp &&
    Math.abs(runnerUp.score - best.score) < 1e-9 &&
    Math.abs(runnerUp.coverage - best.coverage) < 1e-9
  ) {
    return null
  }

  return best
}
