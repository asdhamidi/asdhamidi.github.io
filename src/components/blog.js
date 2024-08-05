import React from "react";
import { useState } from "react";
import BlogPage from "./blog-page";
import axios from "axios";
import BeatLoader from "react-spinners/ClipLoader";

function Blog({ blogList, loading }) {
  const [openedBlog, setOpenedBlog] = useState(false);
  const [currentBlog, setCurrentBlog] = useState([]);
  const openBlog = (id) => {
    axios
      .get("https://blog-api-h1by.vercel.app/posts/" + id)
      .then((res) => {
        setCurrentBlog(res.data);
        setOpenedBlog(true);
      })
      .catch((err) => console.error(err));
  };

  return (
    <div className="blogs">
      {openedBlog === false && (
        <div className="blog-list">
          <h1 className="blog-list-title  content-title">blog</h1>
          <div className="loader-div">
            <BeatLoader
              className="loading-spinner"
              loading={loading}
              size={40}
              aria-label="Loading Spinner"
              data-testid="loader"
            />
          </div>
          {loading === false &&
            blogList.map((blog) => (
              <div className="blog-tab" onClick={() => openBlog(blog._id)}>
                <p className="blog-tab-title">{blog.title}</p>
                <small className="blog-date">{blog.date}</small>
              </div>
            ))}
        </div>
      )}
      {openedBlog === true && (
        <BlogPage
          currentBlog={currentBlog}
          setOpenedBlog={setOpenedBlog}
          setCurrentBlog={setCurrentBlog}
        />
      )}
    </div>
  );
}

export default Blog;
