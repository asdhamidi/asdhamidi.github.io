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
          <p>A data engineer by profession and a lit major by pretension.</p>
          <p>In data engineering, we're essentially plumbers, so you'll usually find me laying down pipelines and tightening the nuts and bolts. Though a leak happens more often than I'd like to admit.
          </p>
          <p>Currently, I am an Associate Data Engineer @ Deloitte USI, where I work across the modern data tech stack - a fancy way of saying I make data move in the right direction.</p>
    </div>
  )
}

export default Home
