// front-end/src/utils/fuzzySearch.js
/**
 * Lightweight fuzzy search utility
 * Handles partial matches, minor misspellings, different word order, and case differences
 */

/**
 * Calculate similarity score between two strings (0-1, higher is better)
 * Uses Levenshtein distance with normalization
 */
function similarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = String(str1).toLowerCase().trim();
  const s2 = String(str2).toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Word-based matching (handles different word order)
  const words1 = s1.split(/\s+/).filter(w => w.length > 0);
  const words2 = s2.split(/\s+/).filter(w => w.length > 0);
  
  if (words1.length > 0 && words2.length > 0) {
    let matchedWords = 0;
    for (const w1 of words1) {
      for (const w2 of words2) {
        if (w1 === w2) {
          matchedWords++;
          break;
        } else if (w1.includes(w2) || w2.includes(w1)) {
          matchedWords += 0.7;
          break;
        }
      }
    }
    const wordScore = (matchedWords / Math.max(words1.length, words2.length)) * 0.8;
    if (wordScore > 0.5) return wordScore;
  }
  
  // Levenshtein distance for character-level similarity
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(s1, s2);
  const similarityScore = 1 - distance / maxLen;
  
  return Math.max(0, similarityScore);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;
  
  const matrix = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[len1][len2];
}

/**
 * Fuzzy search function
 * @param {Array} items - Array of items to search
 * @param {string} query - Search query
 * @param {Array} keys - Array of keys to search in (e.g., ["name", "code"])
 * @param {number} threshold - Minimum similarity score (0-1), default 0.4
 * @returns {Array} Filtered and sorted items with scores
 */
export function fuzzySearch(items, query, keys, threshold = 0.4) {
  if (!query || !query.trim()) return items;
  
  const searchTerm = query.trim().toLowerCase();
  const results = [];
  
  for (const item of items) {
    let maxScore = 0;
    
    for (const key of keys) {
      const value = getNestedValue(item, key);
      if (value == null) continue;
      
      // Direct match gets highest score
      const strValue = String(value).toLowerCase();
      if (strValue === searchTerm) {
        maxScore = 1;
        break;
      }
      
      // Partial match
      if (strValue.includes(searchTerm) || searchTerm.includes(strValue)) {
        maxScore = Math.max(maxScore, 0.85);
        continue;
      }
      
      // Fuzzy similarity
      const score = similarity(searchTerm, strValue);
      maxScore = Math.max(maxScore, score);
    }
    
    if (maxScore >= threshold) {
      results.push({ item, score: maxScore });
    }
  }
  
  // Sort by score (highest first), then by original order
  results.sort((a, b) => {
    if (Math.abs(a.score - b.score) < 0.01) return 0;
    return b.score - a.score;
  });
  
  return results.map(r => r.item);
}

/**
 * Helper to get nested value from object (e.g., "category.name")
 */
function getNestedValue(obj, path) {
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    if (value == null) return null;
    value = value[key];
  }
  return value;
}

/**
 * Pre-configured fuzzy search for products
 * Searches in name, code, brand.name, and category.name
 */
export function fuzzySearchProducts(products, query) {
  return fuzzySearch(products, query, ["name", "code", "brand.name", "category.name"], 0.4);
}

/**
 * Pre-configured fuzzy search for customers
 */
export function fuzzySearchCustomers(customers, query) {
  return fuzzySearch(customers, query, ["name", "email", "phone", "address"], 0.4);
}

