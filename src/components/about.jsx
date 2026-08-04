import React from "react";

const About = ({}) => {
  return (
      <>
        <h1 className="content-title">about me</h1>
        <p>
            I never quite mastered the art of talking about myself, but here's the condensed version
        </p>
        <p>
            I'm an Associate Data Engineer at Deloitte USI where I wrangle data puzzles and wrestle pipelines into submission. My journey into tech was unexpected — an Arts kid who took a wrong turn and found a home in code.
        </p>
        <p>
            I studied Computer Science at GEU, Dehradun where I mostly dabbled in the <i>WebDev</i> side of things
            (thank you, <a href="https://www.theodinproject.com/" target="_blank" rel="noopener noreferrer">The Odin Project<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-up-right" aria-hidden="true"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg></a>) before landing in the world of data.
        </p>
        <p>
            At work I build ELT pipelines, dbt models, PySpark frameworks on Databricks, and lately — agentic AI systems on Snowflake Cortex. Outside of work you'll find me debating Linux distros, spotting planes overhead, or falling down a Wikipedia rabbit hole.
        </p>
        <p>
            I like building things — code, bad puns, or overly elaborate playlists. Currently on a quest to prove that Lemon tea is better than Chai (controversial, I know).
        </p>
      </>
  );
};

export default About;
