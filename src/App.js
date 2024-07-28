import "./App.css";
import { useState } from "react";
import Home from "./components/home";
import About from "./components/about";
import Works from "./components/works";
import Footer from "./components/footer";

function App() {
  const [content, setContent] = useState(1);
  const [home, setHome] = useState("nav-btn active");
  const [about, setAbout] = useState("nav-btn");
  const [works, setWorks] = useState("nav-btn");
  const changePage = (choice) => {
    setContent(choice);
    if (choice === 1) {
      document.title = "asad."
      setHome("nav-btn active");
      setAbout("nav-btn");
      setWorks("nav-btn");
    } else if (choice === 2) {
      document.title = "about | asad."
      setHome("nav-btn");
      setAbout("nav-btn active");
      setWorks("nav-btn");
    } else {
      document.title = "works | asad."
      setHome("nav-btn");
      setAbout("nav-btn");
      setWorks("nav-btn active");
    }
  };

  const [theme, setTheme] = useState("🔆");

  function changeTheme() {
    if (theme === "🔆") setTheme("🌙");
    else setTheme("🔆");

    document.body.classList.toggle("dark");
  }
  return (
    <>
      <div className="nav-container">
        <div className="title">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="icon icon-tabler icons-tabler-filled icon-tabler-arrow-badge-up"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M11.375 6.22l-5 4a1 1 0 0 0 -.375 .78v6l.006 .112a1 1 0 0 0 1.619 .669l4.375 -3.501l4.375 3.5a1 1 0 0 0 1.625 -.78v-6a1 1 0 0 0 -.375 -.78l-5 -4a1 1 0 0 0 -1.25 0z" />
          </svg>
        </div>
        <div className="nav">
          <ul>
            <li>
              <button className={home} onClick={() => changePage(1)}>
                home
              </button>
            </li>
            <li>
              <button className={about} onClick={() => changePage(2)}>
                about
              </button>
            </li>
            <li>
              <button className={works} onClick={() => changePage(3)}>
                works
              </button>
            </li>
          </ul>
          <button className="theme-btn" onClick={changeTheme}>
            {theme}
          </button>
        </div>
      </div>
      <div className="content-container">
        {content === 1 && <Home />}
        {content === 2 && <About />}
        {content === 3 && <Works />}
        <Footer />
      </div>
    </>
  );
}

export default App;
