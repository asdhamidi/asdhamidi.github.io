import "./App.css";
import { useEffect, useState } from "react";
import Nav from "./components/nav";
import Content from "./components/content";

function App() {
  const [content, setContent] = useState(1);
  const [theme, setTheme] = useState("🌙");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    if (mq.matches) {
      document.body.classList.toggle("dark");
      setTheme("🌙");
    }
  }, []);

  return (
    <>
      <Nav
        content={content}
        setContent={setContent}
        theme={theme}
        setTheme={setTheme}
      />
      <Content content={content} />
    </>
  );
}

export default App;
