# AROS PACS - Architecture and Data Flow

This document describes the request/response lifecycle and internal data flow of the AROS PACS system.

## 1. Request Lifecycle Overview

1. **Routing (`arosPacs/urls.py`):**
   - Incoming HTTP requests hit the master URL router.
   - The root `/` redirects all traffic to the `/patients/` portal by default.
   - Traffic is delegated to app-specific URL configurations via `include()` (e.g., `/doctor/` goes to `doctorsDashboard.urls`).

2. **Middleware & Authentication:**
   - Django's built-in session and authentication middleware evaluate the request.
   - Most views across the dashboards use `@login_required` decorators.
   - Custom authentication (`core.backends.EmailBackend`) allows users to log in using their email address instead of standard usernames.

3. **View Logic:**
   - Views process the request, pull context variables (e.g., the authenticated user's profile), interact with the database via the ORM, and return rendered HTML templates.
   - Specific redirect logic (`login_success` in `core/views.py`) determines which dashboard to send a user to upon authentication based on their profile type (Patient, Assistant, Doctor).

## 2. Core Business Workflows

### A. Study Creation Flow (The Assistant & Integration Pipeline)
1. A patient arrives; an **Assistant** logs into the `/assistant/` dashboard.
2. The Assistant searches for or creates a `Patient` profile, then generates a **`StudyRequest`**.
3. A 18-character alphanumeric `pdf_password` is securely auto-generated.
4. The Assistant prints a physical ticket (`first_printed_at` timestamp recorded) which gives the patient access instructions.
5. In the background, the `sync_pacs` Docker container continuously runs the `sync_pacs_images` management command.
6. When the physical study is completed at the modalities (X-Ray/MRI) and hits the PACS system, the sync script pulls the metadata down, matches it against the pending `StudyRequest`, and generates a concrete **`core.Study`**.

### B. Diagnostic Reporting Flow (The Doctor Pipeline)
1. A **ReportingDoctor** logs into the `/doctor/` dashboard.
2. They view a queue of `Study` records that have status `PENDING`.
3. The doctor claims a study, transitioning it to `IN_PROGRESS`.
4. They write the `findings`, `conclusions`, and `recommendations` into a **`core.Report`** entity.
5. The doctor finalizes the report (`COMPLETED`). 
6. `core.views` generates a PDF using `WeasyPrint`, stamping the doctor's PNG signature onto it. 
7. The `email_service.py` is triggered, dispatching an email to the patient with a link to download the results using their 18-character ticket password.

### C. Patient & Associate Doctor Access
- **Patients:** Log in, view a history of their `Study` objects, and download completed PDFs. They can also manage their privacy settings by toggling access for specific `AssociateDoctors`.
- **Associate Doctors:** Must be manually verified by administrators. Once verified, they can view the records of patients who have explicitly shared access with them via the `associated_doctors` ManyToMany relationship.
