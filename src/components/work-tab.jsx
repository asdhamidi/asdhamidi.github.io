import React from "react";

const WorkTab = ({ workTitle, workDesc, workLink, workTech, liveLink, icon }) => {
  return (
    <div className="work-tab">
      <div className="work-info">
          <div className="work-info-deets">
            {/* <div
                dangerouslySetInnerHTML={{ __html: icon}}
            />*/}
            <p className="work-title">{workTitle}</p>
          </div>
        <p className="work-desc">{workDesc}</p>
        {/* <div className="work-tech-stack">
            {workTech && workTech.map((tech, index) => (
                <div className="work-tech-tool">{tech}</div>
            ))}
        </div>*/}
      </div>
        <div className="work-link ">
                <a href={workLink} target="_blank" rel="noopener noreferrer">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-up-right" aria-hidden="true"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg>
                </a>
        </div>
    </div>
  );
};

export default WorkTab;
