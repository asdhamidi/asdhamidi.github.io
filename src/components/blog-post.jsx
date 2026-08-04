import React, { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { getPostBySlug } from "../utils/posts";

function BlogPost() {
  const { slug } = useParams();
  const post = getPostBySlug(slug);

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
      {backButton}
      <p className="blog-title">{post.title}</p>
      <p className="blog-page-date">
        <i>{post.date}</i>
      </p>
      <hr className="blog-divider" />
      <div className="blog-content">
        <ReactMarkdown>{post.content}</ReactMarkdown>
      </div>
    </div>
  );
}

export default BlogPost;
