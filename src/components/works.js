import React from "react";
import WorkTab from "./work-tab";

const Works = ({}) => {
  return (
    <div className="work-content">
      <h1 className="content-title">projects</h1>
      <div className="work-container">
        <WorkTab workTitle="WingWatch" workDesc="A real-time aviation data pipeline that transforms live flight information into clear, actionable insights." workLink="https://github.com/asdhamidi/WingWatch" workTech={['airflow', 'posgtres', 'pyspark', 'minio', 'docker', 'grafana', 'opensky']} icon='<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="#777"  stroke-width="1"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-plane-departure"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14.639 10.258l4.83 -1.294a2 2 0 1 1 1.035 3.863l-14.489 3.883l-4.45 -5.02l2.897 -.776l2.45 1.414l2.897 -.776l-3.743 -6.244l2.898 -.777l5.675 5.727z" /><path d="M3 21h18" /></svg>'/>
        <WorkTab workTitle="Hisaab Analytics" workDesc="Containerized pipeline turning personal expense data into structured insights with Airflow, PySpark, PostgreSQL & MinIO." workLink="https://github.com/asdhamidi/hisaab-pipeline" workTech={['airflow', 'posgtres', 'dbt', 'minio', 'mongodb', 'docker', 'superset']} icon='<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="#777"  stroke-width="1"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-timeline"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 16l6 -7l5 5l5 -6" /><path d="M15 14m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M10 9m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M4 16m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M20 8m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>'/>
        <WorkTab workTitle="Hisaab" workDesc="An expense-tracking web app for my flatmates to manage and log our joint expenses. Comes with automatic expense categorization, budget tracking, and more." workLink="https://github.com/asdhamidi/hisaab" workTech={['react', 'flask', 'mongodb', 'github pages', 'vercel', 'axios']} liveLink="https://asdhamidi.github.io/hisaab" icon='<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="#777"  stroke-width="1"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-calculator"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 3m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /><path d="M8 7m0 1a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1v1a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1z" /><path d="M8 14l0 .01" /><path d="M12 14l0 .01" /><path d="M16 14l0 .01" /><path d="M8 17l0 .01" /><path d="M12 17l0 .01" /><path d="M16 17l0 .01" /></svg>'/>
      </div>
    </div>
  );
};

export default Works;
