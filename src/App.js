import "./App.css";
import { useEffect, useState } from "react";
import Nav from "./components/nav";
import Footer from "./components/footer";
import Content from "./components/content";

function App() {
  const [content, setContent] = useState(1);
  const [theme, setTheme] = useState("☼");

  return (
    <>
      <div id="root-container">
        <Nav
          content={content}
          setContent={setContent}
          theme={theme}
          setTheme={setTheme}
          />
        <Content content={content} />
      </div>
        <Footer />
    </>
  );
}

export default App;
