import React from 'react'
import asadPic from '../assets/asad.jpg'

const Home = ({}) => {
  return (
    <div>
          <div className="home-pic-container">
            <img src={asadPic} alt="me" className='home-pic'/>
            <div>
                <p className="content-title-1">Hey,</p>
                <p className="content-title-1">I am Asad!</p>

            </div>
          </div>
          <p>A data engineer by profession and a lit major by pretension</p>
          <p>In data engineering, we essentially do plumbing, so you will usually find me laying down pipelines and
            tightening the nutbolts. Although, a leak happens more than I show or admit.
          </p>
          <p>As of now, I am an Associate Data Engineer @ Deloitte USI, working on Snowflake, Airflow, dbt, and Databricks — which is a fancy way of saying I make data move in the right direction.</p>
    </div>
  )
}

export default Home
