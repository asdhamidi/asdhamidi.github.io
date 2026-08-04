// Load all .md files as raw strings at build time via Vite's import.meta.glob.
// To add a blog post: drop a .md file in src/posts/ with the frontmatter below.
//
// Required frontmatter fields:
//   title:       "Post Title"
//   date:        "YYYY-MM-DD"
//   slug:        "url-friendly-slug"
//   description: "Short preview shown in the post list."

const modules = import.meta.glob('../posts/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { data: {}, content: raw };

  const frontmatterStr = match[1];
  const content = raw.slice(match[0].length).replace(/^\r?\n/, '');

  const data = {};
  for (const line of frontmatterStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }

  return { data, content };
}

export function getAllPosts() {
  const posts = Object.values(modules).map((raw) => {
    const { data } = parseFrontmatter(raw);
    return {
      title: data.title || 'Untitled',
      date: data.date || '',
      slug: data.slug || '',
      description: data.description || '',
    };
  });

  return posts
    .filter((p) => p.slug)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function getPostBySlug(slug) {
  const raw = Object.values(modules).find((r) => {
    const { data } = parseFrontmatter(r);
    return data.slug === slug;
  });

  if (!raw) return null;

  const { data, content } = parseFrontmatter(raw);
  return {
    title: data.title || 'Untitled',
    date: data.date || '',
    slug: data.slug || '',
    description: data.description || '',
    content,
  };
}
