import React from "react";
import WorkTab from "./work-tab";

const Works = ({}) => {
  return (
    <div className="work-content">
      <h1 className="content-title">projects</h1>
      <div className="work-container">
        <WorkTab workTitle="WingWatch" workDesc="A real-time aviation data pipeline that transforms live flight information into clear, actionable insights." workLink="https://github.com/asdhamidi/WingWatch" workTech={['airflow', 'posgtres', 'pyspark', 'minio', 'docker', 'grafana', 'opensky']}/>
        <WorkTab workTitle="Hisaab Analytics" workDesc="Containerized pipeline turning personal expense data into structured insights with Airflow, PySpark, PostgreSQL & MinIO." workLink="https://github.com/asdhamidi/hisaab-pipeline" workTech={['airflow', 'posgtres', 'dbt', 'minio', 'mongodb', 'docker', 'superset']}/>
        <WorkTab workTitle="Hisaab" workDesc="An expense-tracking web app for my flatmates to manage and log our joint expenses. Comes with automatic expense categorization, budget tracking, and more." workLink="https://github.com/asdhamidi/hisaab" workTech={['react', 'flask', 'mongodb', 'github pages', 'vercel', 'axios']} liveLink="https://asdhamidi.github.io/hisaab"/>
      </div>
    </div>
  );
};

export default Works;
