import Home from "./home";
import About from "./about";
import Works from "./works";
import Footer from "./footer";

function Content({ content }) {
  return (
    <div className="content-container">
      {content === 1 && <Home />}
      {content === 2 && <About />}
      {content === 3 && <Works />}
      <Footer />
    </div>
  );
}

export default Content;
