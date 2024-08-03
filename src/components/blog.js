import React from "react";
import BlogPage from "./blog-page";

function Blog({ blogList }) {
  return (
    <div className="blogs">
      <h1 className="content-title">blog</h1>
      <div className="blog-list">
        {blogList.map((blog) => (
          <div className="blog-tab">
            <p className="blog-title">{blog.title}</p>
            <small className="blog-date">{blog.date}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Blog;
