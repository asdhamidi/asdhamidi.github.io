import React from "react";

const WorkTab = ({ workTitle, workDesc, workLink, workTech, liveLink, icon }) => {
  return (
    <a className="work-tab" href={workLink} target="_blank" rel="noopener noreferrer">
      <div className="work-info">
          <div className="work-info-deets">
            <p className="work-title">{workTitle}</p>
          </div>
        <p className="work-desc">{workDesc}</p>
      </div>
        <div className="work-link">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg>
        </div>
    </a>
  );
};

export default WorkTab;
