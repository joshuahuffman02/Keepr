import { helpTopics, type HelpTopic } from "@/content/help/topics";
import { helpContextMap } from "./context";

export function getAllTopics(): HelpTopic[] {
  return helpTopics;
}

export function getTopicById(id: string): HelpTopic | undefined {
  return helpTopics.find((t) => t.id === id);
}

export function getTopicsByIds(ids: string[]): HelpTopic[] {
  const idSet = new Set(ids);
  return helpTopics.filter((t) => idSet.has(t.id));
}

export function searchTopics(query: string, limit = 30): HelpTopic[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored = helpTopics
    .map((topic) => {
      const title = topic.title.toLowerCase();
      const tags = topic.tags.map((t) => t.toLowerCase());
      const haystack = [
        title,
        topic.summary,
        topic.category,
        tags.join(" "),
        topic.steps.join(" "),
        topic.tips?.join(" ") ?? "",
      ]
        .join(" ")
        .toLowerCase();

      let score = 0;
      if (title.includes(q)) score += 10;
      if (tags.some((tag) => tag.includes(q))) score += 6;
      if (haystack.includes(q)) score += 3;

      // simple typo tolerance: allow small Levenshtein distance on title/tags
      const distance = Math.min(
        levenshtein(q, title.slice(0, 60)),
        ...tags.map((t) => levenshtein(q, t)),
      );
      if (q.length >= 3 && distance <= 2) {
        score += 4 - distance; // closer = higher
      }

      return { topic, score };
    })
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.topic);

  return scored;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

export function getPopularTopics(limit = 6): HelpTopic[] {
  return helpTopics.slice(0, limit);
}

export function getContextTopics(pathname: string): HelpTopic[] {
  const path = pathname || "/";
  for (const entry of helpContextMap) {
    if (entry.match.test(path)) {
      return getTopicsByIds(entry.topicIds);
    }
  }
  return getPopularTopics();
}
