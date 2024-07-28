import React from "react";
import WorkTab from "./work-tab";

const Works = ({}) => {
  return (
    <div className="content-title">
      <h1>works</h1>
      <div className="work-container">
        <WorkTab workTitle="EEG-Motor-Movement" workDesc="EEG Data Analysis and Classification, offering EDA, data preprocessing, and neural network model building for brainwave data." workLink="https://github.com/asdhamidi/EEG-Motor-Movement"/>
        <WorkTab workTitle="Climate Data Analysis" workDesc="An analytical project using machine learning to discover and evaluate temperature trends in climate data." workLink="https://github.com/asdhamidi/global-warming-project" />
      </div>
    </div>
  );
};

export default Works;
