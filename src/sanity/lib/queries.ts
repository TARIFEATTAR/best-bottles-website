// Journal article queries

export const JOURNAL_POSTS_QUERY = `
  *[_type == "journal" && defined(slug.current)] | order(publishedAt desc) {
    _id,
    title,
    "slug": slug.current,
    category,
    publishedAt,
    estimatedReadTime,
    excerpt,
    image,
    generationSource,
  }
`;

export const JOURNAL_POST_QUERY = `
  *[_type == "journal" && slug.current == $slug][0] {
    _id,
    title,
    "slug": slug.current,
    category,
    publishedAt,
    estimatedReadTime,
    excerpt,
    image,
    content,
    generationSource,
    relatedProducts[]-> {
      _id,
      title,
      "slug": shopifyHandle.current,
    },
  }
`;

export const JOURNAL_SLUGS_QUERY = `
  *[_type == "journal" && defined(slug.current)] {
    "slug": slug.current
  }
`;
