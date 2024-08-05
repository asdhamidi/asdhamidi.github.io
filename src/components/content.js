import Home from "./home";
import About from "./about";
import Works from "./works";
import Footer from "./footer";
import Blog from "./blog";
import { useEffect, useState } from "react";
import axios from "axios";

function Content({ content }) {
  const [blogList, setBlogList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("https://blog-api-h1by.vercel.app/posts")
      .then((response) => {
        setLoading(false);
        setBlogList(response.data);
      })
      .catch((error) => console.error(error));
  }, []);

  return (
    <div className="content-container">
      {content === 1 && <Home />}
      {content === 2 && <About />}
      {content === 3 && <Works />}
      {content === 4 && <Blog blogList={blogList} loading={loading} />}
      <Footer />
    </div>
  );
}

export default Content;
