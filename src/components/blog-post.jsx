import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { getPostBySlug } from "../utils/posts";
import remarkGfm from 'remark-gfm';

function BlogPost() {
  const { slug } = useParams();
  const post = getPostBySlug(slug);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const pct = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100;
      setProgress(isFinite(pct) ? pct : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.title = post ? `${post.title} | asad.` : "post not found | asad.";
  }, [post]);

  const backButton = (
    <Link to="/blog" className="blog-page-title">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M9 14l-4 -4l4 -4" />
        <path d="M5 10h11a4 4 0 1 1 0 8h-1" />
      </svg>
      blog
    </Link>
  );

  if (!post) {
    return (
      <div className="blog-page">
        {backButton}
        <p>Post not found.</p>
      </div>
    );
  }

  return (
    <div className="blog-page">
      <div className="reading-progress" style={{ width: `${progress}%` }} />
      <div className="blog-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
      </div>
    </div>
  );
}

export default BlogPost;
