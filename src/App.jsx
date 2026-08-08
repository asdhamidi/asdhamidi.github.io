import "./App.css";
import { useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Nav from "./components/nav";
import Footer from "./components/footer";
import Home from "./components/home";
import About from "./components/about";
import Works from "./components/works";
import Blog from "./components/blog";
import BlogPost from "./components/blog-post";
import Books from "./components/books";

function App() {
  const [theme, setTheme] = useState("☼");
  const location = useLocation();

  useEffect(() => {
    const titleMap = {
      "/": "asad.",
      "/about": "about | asad.",
      "/work": "works | asad.",
      "/blog": "blog | asad.",
      "/books": "books | asad.",
    };
    if (!location.pathname.startsWith("/blog/")) {
      document.title = titleMap[location.pathname] ?? "asad.";
    }
  }, [location.pathname]);

  return (
    <>
      <div id="root-container">
        <Nav theme={theme} setTheme={setTheme} />
        <div className="content-container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/work" element={<Works />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/books" element={<Books />} />
          </Routes>
        </div>
      </div>
      <Footer />
    </>
  );
}

export default App;
