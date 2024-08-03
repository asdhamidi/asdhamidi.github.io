import React from "react";

function BlogPage({ currentBlog, setOpenedBlog, setCurrentBlog }) {
  return (
    <div className="blog-page">
      <h1
        onClick={() => {
          setCurrentBlog([]);
          setOpenedBlog(false);
        }}
        className="blog-page-title"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-back-up"
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M9 14l-4 -4l4 -4" />
          <path d="M5 10h11a4 4 0 1 1 0 8h-1" />
        </svg>
        blog
      </h1>
      <p className="blog-title">{currentBlog.title}</p>
      <p className="blog-date">
        by {currentBlog.author} - {currentBlog.date}
      </p>
      <hr></hr>
      <div
        dangerouslySetInnerHTML={{ __html: currentBlog.content }}
        className="blog-content"
      />
    </div>
  );
}

export default BlogPage;
