import fs from "fs";
import path from "path";
import matter from "gray-matter";

const isDev = process.env.NODE_ENV === "development";

function log(msg: string) {
  if (isDev) {
    console.log(msg);
  }
}

// Robust directory finding
function findBlogDir() {
  log(`[Blog] Starting search. CWD: ${process.cwd()}`);

  const candidates = [
    "/app/content/blog", // Standard Docker Route
    path.join(process.cwd(), "content/blog"), // Relative
    path.join(process.cwd(), "../../../content/blog"), // Monorepo relative
    path.join(process.cwd(), "../../content/blog"), // Alternative relative
    path.join(process.cwd(), "../content/blog"), // Alternative relative
    "/content/blog", // Root fallback
  ];

  for (const candidate of candidates) {
    log(`[Blog] Checking: ${candidate}`);
    if (fs.existsSync(candidate)) {
      log(`[Blog] Found at: ${candidate}`);
      // Verify it has files
      try {
        const files = fs.readdirSync(candidate);
        log(`[Blog] Files in dir: ${files.length}`);
        if (files.length > 0) return candidate;
      } catch (e) {
        log(`[Blog] Error reading dir: ${e}`);
      }
    } else {
      log(`[Blog] Not found at: ${candidate}`);
    }
  }

  log(`[Blog] content/blog directory not found. Searched: ${candidates.join(", ")}`);
  return null;
}

const BLOG_DIR = findBlogDir();

export function getDebugInfo() {
  return {
    cwd: process.cwd(),
    blogDir: BLOG_DIR,
  };
}

export interface BlogPost {
  slug: string;
  category: string;
  title: string;
  description: string;
  date?: string;
  content: string;
  [key: string]: unknown;
}

export function getAllPosts(): BlogPost[] {
  if (!BLOG_DIR) return [];

  const categories = fs
    .readdirSync(BLOG_DIR)
    .filter((file) => fs.statSync(path.join(BLOG_DIR, file)).isDirectory());

  const posts: BlogPost[] = [];

  for (const category of categories) {
    const categoryPath = path.join(BLOG_DIR, category);
    const files = fs.readdirSync(categoryPath).filter((file) => file.endsWith(".md"));

    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      const fileContent = fs.readFileSync(filePath, "utf8");
      const { data, content } = matter(fileContent);

      // Extract title from content if not in frontmatter
      let title = data.title;
      let description = data.description;

      if (!title) {
        const titleMatch = content.match(/^#\s+(.+)$/m);
        if (titleMatch) {
          title = titleMatch[1];
        }
      }

      if (!description) {
        const descMatch = content.match(/\*\*Meta Description:\*\*\s*(.+)$/m);
        if (descMatch) {
          description = descMatch[1];
        }
      }

      posts.push({
        slug: file.replace(/\.md$/, ""),
        category,
        title: title || file.replace(/-/g, " ").replace(".md", ""),
        description: description || "",
        content,
        ...data,
      });
    }
  }

  return posts;
}

export function getPostsByCategory(category: string): BlogPost[] {
  return getAllPosts().filter((post) => post.category === category);
}

export function getPostBySlug(category: string, slug: string): BlogPost | undefined {
  const posts = getAllPosts();
  return posts.find((post) => post.category === category && post.slug === slug);
}

export function getCategories(): string[] {
  if (!BLOG_DIR) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((file) => fs.statSync(path.join(BLOG_DIR, file)).isDirectory());
}
