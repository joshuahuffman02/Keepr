import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// In Docker (NEXT_PUBLIC_API_BASE set), we are at /app/platform/apps/web
// Content is copied to /app/content
// So we need to go up 3 levels: ../../../content/blog
// const BLOG_DIR = path.join(process.cwd(), '../../../content/blog');
// Let's try to be more robust by checking if we are in Docker
const isDocker = process.env.NEXT_PUBLIC_IS_DOCKER === 'true' || process.env.NODE_ENV === 'production';
const BLOG_DIR = path.join(process.cwd(), isDocker ? '../../../content/blog' : '../../../content/blog');
// Actually, process.cwd() in Docker WORKDIR /app/platform/apps/web is exactly that.
// And content is at /app/content.
// So path.join('/app/platform/apps/web', '../../../content/blog') = '/app/content/blog'.
// This SHOULD work if the content is copied there.


export interface BlogPost {
    slug: string;
    category: string;
    title: string;
    description: string;
    date?: string;
    content: string;
    [key: string]: any;
}

export function getAllPosts(): BlogPost[] {
    // If the directory doesn't exist (e.g. in Vercel build without content), return empty
    if (!fs.existsSync(BLOG_DIR)) {
        console.warn(`Blog directory not found at: ${BLOG_DIR}`);
        return [];
    }

    const categories = fs.readdirSync(BLOG_DIR).filter(file =>
        fs.statSync(path.join(BLOG_DIR, file)).isDirectory()
    );

    const posts: BlogPost[] = [];

    for (const category of categories) {
        const categoryPath = path.join(BLOG_DIR, category);
        const files = fs.readdirSync(categoryPath).filter(file => file.endsWith('.md'));

        for (const file of files) {
            const filePath = path.join(categoryPath, file);
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const { data, content } = matter(fileContent);

            // Extract title from content if not in frontmatter (our current posts use H1 # Title)
            let title = data.title;
            let description = data.description;

            // Parse H1 if title missing
            if (!title) {
                const titleMatch = content.match(/^#\s+(.+)$/m);
                if (titleMatch) {
                    title = titleMatch[1];
                }
            }

            // Parse Meta Description if description missing
            if (!description) {
                const descMatch = content.match(/\*\*Meta Description:\*\*\s*(.+)$/m);
                if (descMatch) {
                    description = descMatch[1];
                }
            }

            posts.push({
                slug: file.replace(/\.md$/, ''),
                category,
                title: title || file.replace(/-/g, ' ').replace('.md', ''),
                description: description || '',
                content,
                ...data,
            });
        }
    }

    return posts;
}

export function getPostsByCategory(category: string): BlogPost[] {
    return getAllPosts().filter(post => post.category === category);
}

export function getPostBySlug(category: string, slug: string): BlogPost | undefined {
    const posts = getAllPosts();
    return posts.find(post => post.category === category && post.slug === slug);
}

export function getCategories(): string[] {
    if (!fs.existsSync(BLOG_DIR)) return [];
    return fs.readdirSync(BLOG_DIR).filter(file =>
        fs.statSync(path.join(BLOG_DIR, file)).isDirectory()
    );
}
