import React from "react";
import resumePDF from "../assets/Asadullah_Hamidi_Resume.pdf";

const Footer = ({}) => {
  return (
    <footer>
      <hr className="small-hr" />
      <div className="links">
        <a className="link" href="mailto:asad.hamidi119@gmail.com">
            mail
        </a>
        •
        <a className="link" href="https://github.com/asdhamidi">
            github
        </a>
        •
        <a className="link" href="https://www.linkedin.com/in/asadullah-hamidi/">
            linkedin
        </a>
        /
        <a className="link resume-footer-link" href={resumePDF} download="Asadullah_Hamidi_Resume.pdf">
            [résumé]
        </a>
      </div>
    </footer>
  );
};

export default Footer;
