# AROS PACS - Backend Structure

This document outlines the high-level architecture and folder structure of the AROS PACS backend.

## 1. Overview
AROS PACS is built using Python and the **Django** web framework. The backend provides a series of "Dashboards" or portals, each tailored to a specific user role (Patients, Doctors, Associate Doctors, and Assistants). 
The application interfaces with an external PACS/RIS system (Raditech API) for image synchronization and study retrieval.

## 2. Project Layout
The main source directory is `arosPacs/`, which contains the following key components:

- **`arosPacs/` (Configuration App):** 
  - `settings.py`: Contains all system settings, database configurations, allowed hosts, static/media file routing (S3 vs local), and integration keys for Raditech.
  - `urls.py`: The master URL router mapping incoming requests to the respective dashboard applications.
  - `asgi.py` & `wsgi.py`: Entry points for asynchronous (Channels) and synchronous web server execution (Daphne/Gunicorn).

- **`core/` (Shared Logic & Common Engine):** 
  - `models.py`: Defines the `Study` and `Report` entities, which are central to the application.
  - `views.py`: Shared views for generating PDFs, handling global authentication redirects, and verifying email links.
  - `email_service.py`: Centralized utility for sending notification emails (welcome, verification, report completion).
  - `raditech_mapping.py`: Contains dictionaries and mapping logic to translate internal study requests to Raditech's specific ID formats.

- **`patientsDashboard/`:**
  - Manages the `Patient` profile, allowing patients to log in, view their study history, and download their medical reports.

- **`doctorsDashboard/`:**
  - Manages the `ReportingDoctor` profile. Radiologists log in here to claim pending studies, write diagnostic text, and sign off on reports.

- **`associateDoctorDashboard/`:**
  - Manages the `AssociateDoctor` profile (referring physicians). Allows external doctors to view studies for patients who have explicitly shared their records with them.

- **`assistantDashboard/`:**
  - Manages the `Assistant` profile (front-desk staff). Responsible for creating `StudyRequest` tickets when patients arrive, printing access codes, and initiating the workflow.

## 3. Infrastructure & Deployment
- **Docker Compose:** Used to spin up the local/production environment consisting of:
  - `web`: The Django application running via Daphne.
  - `nginx`: Reverse proxy serving static files and routing traffic.
  - `postgres`: The main relational database.
  - `redis`: In-memory data store used by Django Channels for WebSockets (if applicable) and caching.
  - `sync_pacs`: A background worker running a custom management command (`sync_pacs_images`) to pull incoming images from Raditech.
