import "./App.css";
import { useEffect, useState } from "react";
import Nav from "./components/nav";
import Content from "./components/content";

function App() {
  const [content, setContent] = useState(1);
  const [theme, setTheme] = useState("🌙");

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
