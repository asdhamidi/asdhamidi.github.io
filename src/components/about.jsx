import React from "react";

const About = ({}) => {
  return (
      <>
        <h1 className="content-title">about me</h1>
        <p>
            I never quite mastered the art of talking about myself, but here's an attempt.
        </p>
        <p>
            I'm an Associate Data Engineer at Deloitte USI where I solve data puzzles and wrestle pipelines into submission. My journey into tech was unexpected - a literature kid who took a wrong turn and somehow never looked back.
        </p>
        <p>
            Turns out the wrong turn had a lot of side roads. I've spent years going down most of them - backend development, web dev, Linux, cloud, AI - not because the job required it, but because I couldn't help it. What's always hooked me is the engineering judgment - not just making something work, but asking why this design over that one, where things break quietly, what it actually takes to make something last.
        </p>
        <p>
            At work, I deal with data pipelines, Python frameworks, and lately agentic AI systems, mostly building things that sit a bit outside what standard tooling gives you out of the box. It's uncharted territory with no clear map, and surprises that catch you off-guard.
        </p>
        <p>
            Outside of work you'll find me looking at FlightRadar24 after spotting planes overhead, reading the most obscure Wikipedia articles, or simply enjoying my cup of Chai. I also write at <a href="https://thewrongturn.substack.com/" target="_blank" rel="noopener noreferrer">The Wrong Turn<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-up-right" aria-hidden="true"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg></a> - equal parts personal essays and overthinking out loud. 
        </p>
      </>
  );
};

export default About;
