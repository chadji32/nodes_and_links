# Full Stack Task – Web Application

## Overview  
This project is a full-stack web application built with an **Angular frontend** and a **Node.js backend**.  
The backend exposes RESTful endpoints to serve the provided CSV data, while the frontend consumes this data and displays it through responsive and interactive charts.  

The application demonstrates:  
- Responsive UI design with Angular  
- Data visualization using multiple chart types  
- A RESTful backend that serves structured data  
- Clean component architecture and basic error handling  

---

## Prerequisites  
Before running the project, ensure the following tools are installed on your system:  
- Node.js (version 16 or later is recommended)  
- Angular CLI (used for running the frontend application)  

---

## Set up Instructions  

### Backend  
1. Open a terminal and navigate to the backend folder.  
2. Install the required dependencies using Node Package Manager.  
3. Start the backend server.  

The backend will be running at **http://localhost:3000**  

---

### Frontend  
1. Open a new terminal and navigate to the frontend folder.  
2. Install the required dependencies using Node Package Manager.  
3. Start the Angular application.  

The frontend will be running at **http://localhost:4200**  

---

## Data  
The application uses two CSV datasets that were provided with the assignment:  
- **Activities Table** – contains the start and end date of each activity.  
- **Adjacency Matrix** – defines the directed links between activities. If `A(i,j) = 1`, there is a link from activity *i* to activity *j*.  

These datasets are processed by the backend and visualized in the frontend charts.  

---

## Development Notes  
- The backend and frontend should be run in **separate terminals**.  
- The frontend is configured to connect to the backend at `http://localhost:3000`.  
- For deployment, the frontend can be built into production files using Angular’s build process.  

---

## AI Stretch Goal  
This project used **ChatGPT** to accelerate development and maintain code clarity .  
AI was used for:  
- Generating and refining code
- Improving documentation structure (README, etc.)