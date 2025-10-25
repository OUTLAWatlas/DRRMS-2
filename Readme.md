_**🌍 Disaster Relief Resource Management System (DRRMS)**_
**📖 Overview**

The Disaster Relief Resource Management System (DRRMS) is an internet-based platform designed to optimize the allocation and deployment of critical resources during natural and man-made disasters.

The system provides dual portals:

🧑‍🚒 Rescuer Portal – For relief agencies, NGOs, and government authorities to allocate, track, and manage resources.

🆘 Survivor Portal – For disaster-affected individuals to request aid, report needs, and track relief status.

At its core, DRRMS leverages dynamic scoring and criticality thresholds to intelligently prioritize rescue and resource distribution. The system is built as a multi-semester project, expanding gradually to integrate real-time data, offline-first capabilities, AI-driven decision-making, and advanced security protocols.

**🎯 Objectives**

Enable efficient resource allocation during disasters.

Provide real-time communication between survivors and rescuers.

Minimize delays with automated prioritization of critical needs.

Ensure transparency and accountability in relief operations.

Support scalable, secure, and offline-capable infrastructure for real-world deployment.

**⚙️ Features**
✅ Core Features (Semester 1)

🔑 Authentication System (Survivors & Rescuers)

📦 Resource Management Module – Track supplies (food, medicine, shelters, etc.)

🆘 Request Management – Survivors submit requests with location & need details

📊 Dynamic Prioritization Engine – Allocates resources using scoring algorithms

💰 Transaction & Revenue Tracking (for paid services/logistics)

📅 Booking & Allocation History

🚀 Advanced Features (Future Semesters)

🌐 Real-Time Data Integration (weather APIs, government feeds, etc.)

🤖 AI-Powered Predictive Allocation – Anticipate demand based on patterns

🔒 Blockchain for Transparency – Immutable records of aid distribution

📡 Offline-First Capability – Resilient system in low-connectivity zones

📍 Geospatial Mapping – Heatmaps for demand, supply & disaster zones

**🏗️ Software Architecture**

The system follows a modular, service-oriented architecture with clear separation of concerns.

🔹 High-Level Architecture

Frontend (UI/UX): ReactJS / Next.js with TailwindCSS

Backend (API): Flask (Python) with REST APIs

Database: PostgreSQL (preferred for scalability & GIS support)

Resource Allocation Engine: Python-based scoring algorithms

Hosting/Cloud: AWS / GCP (future scaling)

Security: JWT authentication, role-based access

**🛠️ Tech Stack**
🌐 Frontend

ReactJS / Next.js – Component-based UI

TailwindCSS / ShadCN UI – Modern, responsive styling

Framer Motion – Smooth animations

Axios – API communication

⚙️ Backend

Flask (Python) – REST API framework

Flask-RESTful – Endpoint management

psycopg2 / SQLAlchemy – PostgreSQL connectivity

Celery + Redis (future) – Task scheduling & background jobs

🗄️ Database

PostgreSQL – Advanced relational database with:

✅ Support for JSONB – Store semi-structured disaster reports

✅ PostGIS Extension – Geospatial queries for mapping & allocation

✅ Advanced Indexing – Faster query execution under heavy load

✅ ACID Compliance – Ensures data integrity in crisis conditions

Core Tables:

resources (types, quantities, locations)

requests (survivor submissions + geo-coordinates)

rescuers (NGOs, government units)

transactions (aid & funding records)

bookings (allocations & logistics)

☁️ Cloud & DevOps (Planned)

Docker & Kubernetes – Containerization & orchestration

CI/CD Pipelines – GitHub Actions / Jenkins

AWS/GCP Cloud Deployment – Scalable infrastructure

Terraform (IaC) – Infrastructure automation

**📊 Resource Allocation Algorithm**

The Dynamic Scoring Model considers:

🚨 Severity of request (medical > shelter > food)

📍 Geographic proximity (PostGIS queries)

👨‍👩‍👧 Number of survivors affected

⏳ Time since request submitted

🏢 Resource availability at nearest hub

Each request gets a Criticality Score → Resources allocated to highest scores first.

**🔒 Security & Ethics**
Data Encryption for sensitive info

Role-Based Access Control (RBAC)

Transparency Logs for resource allocation

Ethical Use Guidelines – Built to save lives, not for misuse

**🤝 Contributing**

Contributions are welcome! 🚀

Fork the repo

Create a feature branch (feature/new-module)

Commit changes (git commit -m "Added X feature")

Open a pull request

**👥 Team**
Frontend Engg - Arrnav Pawar, Mahendra Patil
Backend Engg - Krishna Patil
Documentation Lead - Saumya Patil
Domain: Disaster Relief & Resource Management
Institute: Vishwakarma Institute of Technology (VIT Pune)

**📜 License**

This project is licensed under the MIT License – free to use, modify, and distribute with attribution.

**🌟 Acknowledgements**

Disaster management frameworks (NDMA, UN OCHA)

Open-source communities (Flask, React, PostgreSQL)

Inspiration from real-world challenges faced during COVID-19, floods, and earthquakes
