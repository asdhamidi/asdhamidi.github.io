import "./App.css";
import { useState } from "react";
import Nav from "./components/nav";
import Content from "./components/content";

function App() {
  const [content, setContent] = useState(1);

  return (
    <>
      <Nav content={content} setContent={setContent} />
      <Content content={content}/>
    </>
  );
}

export default App;
