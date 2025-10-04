import React from "react";
import { useState } from "react";

const Nav = ({ content, setContent, theme, setTheme }) => {
  const [home, setHome] = useState("nav-btn active");
  const [about, setAbout] = useState("nav-btn");
  const [works, setWorks] = useState("nav-btn");
  const [blog, setBlog] = useState("nav-btn");

  const changePage = (choice) => {
    setContent(choice);
    if (choice === 1) {
      document.title = "asad.";
      setHome("nav-btn active");
      setAbout("nav-btn");
      setWorks("nav-btn");
      setBlog("nav-btn");
    } else if (choice === 2) {
      document.title = "about | asad.";
      setHome("nav-btn");
      setAbout("nav-btn active");
      setWorks("nav-btn");
      setBlog("nav-btn");
    } else if (choice === 3) {
      document.title = "works | asad.";
      setHome("nav-btn");
      setAbout("nav-btn");
      setWorks("nav-btn active");
      setBlog("nav-btn");
    } else {
      document.title = "blog | asad.";
      setHome("nav-btn");
      setAbout("nav-btn");
      setWorks("nav-btn");
      setBlog("nav-btn active");
    }
  };

  function changeTheme() {
    if (theme === "☾") setTheme("☼");
        else setTheme("☾");

    document.body.classList.toggle("dark");
  }
  return (
    <div className="nav-container">
      <nav className="nav">
        <ul>
            <li>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                          <path d="M11.375 6.22l-5 4a1 1 0 0 0 -.375 .78v6l.006 .112a1 1 0 0 0 1.619 .669l4.375 -3.501l4.375 3.5a1 1 0 0 0 1.625 -.78v-6a1 1 0 0 0 -.375 -.78l-5 -4a1 1 0 0 0 -1.25 0z" />
                        </svg>
                      </li>
          <li>
            <button className={"title " + home} onClick={() => changePage(1)}>
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
              work
            </button>
          </li>
        </ul>
        <div>
          <button className="theme-btn" onClick={changeTheme}>
              {theme}
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Nav;
