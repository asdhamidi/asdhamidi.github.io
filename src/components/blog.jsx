import React from "react";
import { Link } from "react-router-dom";
import { getAllPosts } from "../utils/posts";

function Blog() {
  const posts = getAllPosts();

  return (
    <div className="blogs">
      <h1 className="content-title">blog</h1>
      <div className="blog-list">
        {posts.length === 0 && (
          <p style={{ color: "var(--text-color-light)" }}>No posts yet.</p>
        )}
        {posts.map((post) => (
          <Link to={`/blog/${post.slug}`} key={post.slug} className="blog-tab">
            <div className="blog-info">
              <div className="blog-info-deets">
                <p className="blog-tab-title">{post.title}</p>
              </div>
              {post.description && (
                <p className="blog-desc">{post.description}</p>
              )}
              {/* <small className="blog-date">
                <i>{post.date}</i>
              </small>*/}
            </div>
            <div className="work-link">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default Blog;
