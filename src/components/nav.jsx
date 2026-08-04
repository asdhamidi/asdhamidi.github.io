import React from "react";
import { NavLink } from "react-router-dom";

const Nav = ({ theme, setTheme }) => {
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
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                "nav-btn title" + (isActive ? " active" : "")
              }
            >
              home
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/about"
              className={({ isActive }) =>
                "nav-btn" + (isActive ? " active" : "")
              }
            >
              about
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/work"
              className={({ isActive }) =>
                "nav-btn" + (isActive ? " active" : "")
              }
            >
              work
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/blog"
              className={({ isActive }) =>
                "nav-btn" + (isActive ? " active" : "")
              }
            >
              blog
            </NavLink>
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
