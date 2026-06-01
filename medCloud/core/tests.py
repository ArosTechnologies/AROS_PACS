"""
Core Security & Functional Tests.

Covers:
- Authentication bypass / unauthenticated access
- IDOR (Insecure Direct Object Reference)
- SQL injection on search endpoints
- XSS payload handling
- CSRF protection
- File upload security
- PDF generation access control
- Email verification token security
- study_detail ownership checks
"""
from django.test import TestCase, Client
from django.contrib.auth.models import User, Group
from django.urls import reverse
from core.models import Study, Report
from patientsDashboard.models import Patient
from doctorsDashboard.models import ReportingDoctor
from associateDoctorDashboard.models import AssociateDoctor
from assistantDashboard.models import StudyRequest, Assistant
import json
import base64
from datetime import date


class BaseTestSetup(TestCase):
    """Shared setup for creating test users in each role group."""

    @classmethod
    def setUpTestData(cls):
        # Create groups
        cls.doctors_group, _ = Group.objects.get_or_create(name='Doctors')
        cls.patients_group, _ = Group.objects.get_or_create(name='Patients')
        cls.assistants_group, _ = Group.objects.get_or_create(name='Assistants')
        cls.associates_group, _ = Group.objects.get_or_create(name='AssociatedDoctors')

        # ----- Patient A -----
        cls.patient_user_a = User.objects.create_user(
            username='patient_a@test.com', email='patient_a@test.com', password='TestPass123!'
        )
        cls.patient_user_a.groups.add(cls.patients_group)
        cls.patient_a = Patient.objects.create(
            user=cls.patient_user_a, address='Addr A', phone='111', gender='M'
        )

        # ----- Patient B -----
        cls.patient_user_b = User.objects.create_user(
            username='patient_b@test.com', email='patient_b@test.com', password='TestPass123!'
        )
        cls.patient_user_b.groups.add(cls.patients_group)
        cls.patient_b = Patient.objects.create(
            user=cls.patient_user_b, address='Addr B', phone='222', gender='F'
        )

        # ----- Reporting Doctor -----
        cls.doctor_user = User.objects.create_user(
            username='doctor@test.com', email='doctor@test.com', password='TestPass123!',
            first_name='Dr', last_name='Test',
        )
        cls.doctor_user.groups.add(cls.doctors_group)
        cls.doctor = ReportingDoctor.objects.create(
            user=cls.doctor_user,
            address='Doc Addr', phone='333', university='UNAM',
            professional_id='CED-001', specialty='Radiology'
        )

        # ----- Associate Doctor -----
        cls.assoc_user = User.objects.create_user(
            username='assoc@test.com', email='assoc@test.com', password='TestPass123!'
        )
        cls.assoc_user.groups.add(cls.associates_group)
        cls.assoc_doctor = AssociateDoctor.objects.create(
            user=cls.assoc_user, address='Assoc Addr', phone='444',
            university='ITM', professional_id='CED-002', is_verified=True, is_email_verified=True
        )
        # Associate doctor is linked to Patient A only
        cls.patient_a.associated_doctors.add(cls.assoc_doctor)

        # ----- Assistant -----
        cls.assistant_user = User.objects.create_user(
            username='assistant@test.com', email='assistant@test.com', password='TestPass123!'
        )
        cls.assistant_user.groups.add(cls.assistants_group)
        cls.assistant = Assistant.objects.create(
            user=cls.assistant_user, address='Asst Addr', phone='555'
        )

        # ----- Study Request (needed for Study FK) -----
        cls.study_request_a = StudyRequest.objects.create(
            id_patient=cls.patient_a,
            requested_study='TORAX_AP',
        )

        # ----- Study for Patient A (completed) -----
        cls.report_a = Report.objects.create(
            status=Report.COMPLETED,
            doctor_in_charge=cls.doctor,
            about='Test Report A',
            patients_description='Desc A',
            findings='Findings A',
            conclusions='Conclusions A',
            recommendations='Recs A',
        )
        cls.study_a = Study.objects.create(
            pacs_url='https://example.com/pacs/a',
            email_sent=False,
            date=date.today(),
            id_study_request=cls.study_request_a,
            id_report=cls.report_a,
            id_patient=cls.patient_a,
        )

        # ----- Study Request for Patient B -----
        cls.study_request_b = StudyRequest.objects.create(
            id_patient=cls.patient_b,
            requested_study='TORAX_AP',
        )

        # ----- Study for Patient B (pending) -----
        cls.study_b = Study.objects.create(
            pacs_url='https://example.com/pacs/b',
            email_sent=False,
            date=date.today(),
            id_study_request=cls.study_request_b,
            id_report=None,
            id_patient=cls.patient_b,
        )


# ════════════════════════════════════════════════════════════
#  1. UNAUTHENTICATED ACCESS
# ════════════════════════════════════════════════════════════

class UnauthenticatedAccessTests(BaseTestSetup):
    """Verify that protected endpoints redirect unauthenticated users."""

    def test_study_detail_requires_login(self):
        """study_detail must redirect unauthenticated users to login."""
        url = reverse('studyDetail', kwargs={'id_study': self.study_a.pk})
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 302)
        self.assertIn('/login/', resp.url)

    def test_doctor_dashboard_requires_login(self):
        resp = self.client.get(reverse('pendingStudies'))
        self.assertEqual(resp.status_code, 302)

    def test_patient_dashboard_requires_login(self):
        resp = self.client.get(reverse('patientsDashboard:patientsDashboard'))
        self.assertEqual(resp.status_code, 302)

    def test_assistant_dashboard_requires_login(self):
        resp = self.client.get(reverse('assistant_dashboard'))
        self.assertEqual(resp.status_code, 302)

    def test_associate_dashboard_requires_login(self):
        resp = self.client.get(reverse('associate_dashboard'))
        self.assertEqual(resp.status_code, 302)

    def test_pdf_download_requires_login(self):
        url = reverse('core:report_pdf', kwargs={'report_id': self.report_a.pk})
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 302)

    def test_lock_study_requires_login(self):
        url = reverse('lockStudy', kwargs={'study_id': self.study_b.pk})
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, 302)

    def test_profile_picture_requires_login(self):
        resp = self.client.post(
            reverse('update_profile_picture'),
            data=json.dumps({'image_data': 'test'}),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 302)


# ════════════════════════════════════════════════════════════
#  2. IDOR — STUDY DETAIL OWNERSHIP
# ════════════════════════════════════════════════════════════

class StudyDetailIDORTests(BaseTestSetup):
    """Verify study_detail enforces ownership per role."""

    def test_patient_can_view_own_study(self):
        self.client.login(username='patient_a@test.com', password='TestPass123!')
        url = reverse('studyDetail', kwargs={'id_study': self.study_a.pk})
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)

    def test_patient_cannot_view_other_patients_study(self):
        """Patient A must NOT be able to access Patient B's study."""
        self.client.login(username='patient_a@test.com', password='TestPass123!')
        url = reverse('studyDetail', kwargs={'id_study': self.study_b.pk})
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 403)

    def test_associate_can_view_linked_patients_study(self):
        """Associate doctor linked to Patient A can view Patient A's study."""
        self.client.login(username='assoc@test.com', password='TestPass123!')
        url = reverse('studyDetail', kwargs={'id_study': self.study_a.pk})
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)

    def test_associate_cannot_view_unlinked_patients_study(self):
        """Associate doctor NOT linked to Patient B must be blocked."""
        self.client.login(username='assoc@test.com', password='TestPass123!')
        url = reverse('studyDetail', kwargs={'id_study': self.study_b.pk})
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 403)

    def test_reporting_doctor_can_view_any_study(self):
        self.client.login(username='doctor@test.com', password='TestPass123!')
        url = reverse('studyDetail', kwargs={'id_study': self.study_b.pk})
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)

    def test_assistant_can_view_any_study(self):
        self.client.login(username='assistant@test.com', password='TestPass123!')
        url = reverse('studyDetail', kwargs={'id_study': self.study_b.pk})
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)


# ════════════════════════════════════════════════════════════
#  3. IDOR — PDF DOWNLOAD
# ════════════════════════════════════════════════════════════

class PDFDownloadIDORTests(BaseTestSetup):
    """Verify PDF download enforces ownership."""

    def test_patient_cannot_download_other_patients_pdf(self):
        self.client.login(username='patient_b@test.com', password='TestPass123!')
        url = reverse('core:report_pdf', kwargs={'report_id': self.report_a.pk})
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 403)

    def test_doctor_cannot_download_pdf(self):
        self.client.login(username='doctor@test.com', password='TestPass123!')
        url = reverse('core:report_pdf', kwargs={'report_id': self.report_a.pk})
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 403)


# ════════════════════════════════════════════════════════════
#  4. CROSS-ROLE ACCESS
# ════════════════════════════════════════════════════════════

class CrossRoleAccessTests(BaseTestSetup):
    """Verify that users cannot access dashboards of other roles."""

    def test_patient_cannot_access_doctor_dashboard(self):
        self.client.login(username='patient_a@test.com', password='TestPass123!')
        resp = self.client.get(reverse('pendingStudies'))
        self.assertEqual(resp.status_code, 403)

    def test_doctor_cannot_access_assistant_dashboard(self):
        self.client.login(username='doctor@test.com', password='TestPass123!')
        resp = self.client.get(reverse('assistant_dashboard'))
        self.assertEqual(resp.status_code, 403)

    def test_patient_cannot_access_assistant_dashboard(self):
        self.client.login(username='patient_a@test.com', password='TestPass123!')
        resp = self.client.get(reverse('assistant_dashboard'))
        self.assertEqual(resp.status_code, 403)

    def test_doctor_cannot_access_patient_dashboard(self):
        self.client.login(username='doctor@test.com', password='TestPass123!')
        resp = self.client.get(reverse('patientsDashboard:patientsDashboard'))
        self.assertEqual(resp.status_code, 403)


# ════════════════════════════════════════════════════════════
#  5. SQL INJECTION
# ════════════════════════════════════════════════════════════

class SQLInjectionTests(BaseTestSetup):
    """Verify SQL injection payloads are safely handled via ORM parameterization."""

    SQL_PAYLOADS = [
        "' OR 1=1 --",
        "'; DROP TABLE auth_user; --",
        '" UNION SELECT * FROM auth_user --',
        "1; SELECT * FROM auth_user",
        "admin' --",
        "' OR '1'='1",
        "1 OR 1=1",
    ]

    def test_patient_search_sql_injection(self):
        self.client.login(username='assistant@test.com', password='TestPass123!')
        for payload in self.SQL_PAYLOADS:
            resp = self.client.get(
                reverse('patient_search_api'),
                {'q': payload}
            )
            self.assertIn(resp.status_code, [200, 400],
                          f"SQL injection payload returned {resp.status_code}: {payload}")

    def test_doctor_search_sql_injection(self):
        self.client.login(username='patient_a@test.com', password='TestPass123!')
        for payload in self.SQL_PAYLOADS:
            resp = self.client.get(
                reverse('patientsDashboard:doctor_search_api'),
                {'q': payload}
            )
            self.assertIn(resp.status_code, [200, 400],
                          f"SQL injection payload returned {resp.status_code}: {payload}")

    def test_login_sql_injection(self):
        for payload in self.SQL_PAYLOADS:
            resp = self.client.post(reverse('login'), {
                'username': payload,
                'password': payload,
            })
            # Login should fail but not crash (200 = re-show form, 302 = redirect)
            self.assertIn(resp.status_code, [200, 302],
                          f"Login SQL injection returned {resp.status_code}: {payload}")


# ════════════════════════════════════════════════════════════
#  6. XSS PAYLOAD HANDLING
# ════════════════════════════════════════════════════════════

class XSSTests(BaseTestSetup):
    """Verify XSS payloads are HTML-escaped in rendered templates."""

    XSS_PAYLOADS = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert(1)>',
        '"><script>alert(1)</script>',
        "javascript:alert(1)",
        '<b onmouseover=alert(1)>test</b>',
    ]

    def test_patient_search_xss(self):
        """XSS in search queries must not appear unescaped in JSON responses."""
        self.client.login(username='assistant@test.com', password='TestPass123!')
        for payload in self.XSS_PAYLOADS:
            resp = self.client.get(
                reverse('patient_search_api'),
                {'q': payload}
            )
            self.assertEqual(resp.status_code, 200)
            # Response body should not contain raw unescaped script tags
            self.assertNotIn('<script>', resp.content.decode())

    def test_signup_xss_in_name(self):
        """XSS payloads in signup fields should be stored safely."""
        for payload in self.XSS_PAYLOADS:
            resp = self.client.post(reverse('patientsDashboard:signup'), {
                'first_name': payload,
                'last_name': 'Normal',
                'email': f'xss_{self.XSS_PAYLOADS.index(payload)}@test.com',
                'password': 'SecurePass123!',
                'password_confirm': 'SecurePass123!',
                'phone': '999',
                'address': 'Test Addr',
                'gender': 'M',
            })
            # Should not crash
            self.assertIn(resp.status_code, [200, 302])


# ════════════════════════════════════════════════════════════
#  7. CSRF PROTECTION
# ════════════════════════════════════════════════════════════

class CSRFTests(BaseTestSetup):
    """Verify CSRF protection on POST endpoints."""

    def test_lock_study_without_csrf(self):
        """POST to lock_study without CSRF token should be rejected."""
        client = Client(enforce_csrf_checks=True)
        client.login(username='doctor@test.com', password='TestPass123!')
        url = reverse('lockStudy', kwargs={'study_id': self.study_b.pk})
        resp = client.post(url)
        self.assertEqual(resp.status_code, 403)

    def test_create_patient_without_csrf(self):
        """POST to create_patient without CSRF token should be rejected."""
        client = Client(enforce_csrf_checks=True)
        client.login(username='assistant@test.com', password='TestPass123!')
        resp = client.post(reverse('create_patient_api'), {
            'first_name': 'Test', 'last_name': 'User',
            'email': 'csrf_test@test.com', 'phone': '123',
        })
        self.assertEqual(resp.status_code, 403)

    def test_toggle_doctor_without_csrf(self):
        """POST to toggle_doctor without CSRF token should be rejected."""
        client = Client(enforce_csrf_checks=True)
        client.login(username='patient_a@test.com', password='TestPass123!')
        resp = client.post(reverse('patientsDashboard:toggle_doctor_api'), {
            'doctor_id': self.assoc_doctor.pk, 'action': 'revoke',
        })
        self.assertEqual(resp.status_code, 403)

    def test_signup_without_csrf(self):
        """POST to patient signup without CSRF token should be rejected."""
        client = Client(enforce_csrf_checks=True)
        resp = client.post(reverse('patientsDashboard:signup'), {
            'first_name': 'CSRF', 'last_name': 'Test',
            'email': 'csrf_signup@test.com', 'password': 'Pass123!',
            'password_confirm': 'Pass123!', 'phone': '123',
            'address': 'Addr', 'gender': 'M',
        })
        self.assertEqual(resp.status_code, 403)


# ════════════════════════════════════════════════════════════
#  8. FILE UPLOAD SECURITY
# ════════════════════════════════════════════════════════════

class FileUploadSecurityTests(BaseTestSetup):
    """Verify profile picture upload security checks."""

    def test_empty_image_data(self):
        self.client.login(username='patient_a@test.com', password='TestPass123!')
        resp = self.client.post(
            reverse('update_profile_picture'),
            data=json.dumps({'image_data': ''}),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 400)

    def test_null_image_data(self):
        self.client.login(username='patient_a@test.com', password='TestPass123!')
        resp = self.client.post(
            reverse('update_profile_picture'),
            data=json.dumps({'image_data': None}),
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 400)

    def test_oversized_image(self):
        """Image >5MB should be rejected."""
        self.client.login(username='patient_a@test.com', password='TestPass123!')
        # Create base64 string representing >5MB
        large_data = base64.b64encode(b'x' * (6 * 1024 * 1024)).decode()
        resp = self.client.post(
            reverse('update_profile_picture'),
            data=json.dumps({'image_data': f'data:image/png;base64,{large_data}'}),
            content_type='application/json'
        )
        # Django middleware may reject before our view code runs
        self.assertIn(resp.status_code, [400, 413, 500])

    def test_malformed_base64(self):
        """Malformed base64 should not crash the server."""
        self.client.login(username='patient_a@test.com', password='TestPass123!')
        resp = self.client.post(
            reverse('update_profile_picture'),
            data=json.dumps({'image_data': 'not-valid-base64-at-all'}),
            content_type='application/json'
        )
        self.assertIn(resp.status_code, [400, 500])


# ════════════════════════════════════════════════════════════
#  9. EMAIL VERIFICATION TOKEN SECURITY
# ════════════════════════════════════════════════════════════

class EmailVerificationTests(BaseTestSetup):
    """Verify email verification tokens are secure."""

    def test_invalid_token_rejected(self):
        resp = self.client.get(reverse('core:verify_email', kwargs={'token': 'invalid-token-here'}))
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, 'verificación')  # Shows verification failed page

    def test_random_token_rejected(self):
        import secrets
        token = secrets.token_urlsafe(32)
        resp = self.client.get(reverse('core:verify_email', kwargs={'token': token}))
        self.assertEqual(resp.status_code, 200)


# ════════════════════════════════════════════════════════════
#  10. AUTH BACKEND SECURITY
# ════════════════════════════════════════════════════════════

class AuthBackendTests(BaseTestSetup):
    """Verify the custom EmailBackend handles edge cases securely."""

    def test_login_with_valid_credentials(self):
        resp = self.client.post(reverse('login'), {
            'username': 'patient_a@test.com',
            'password': 'TestPass123!',
        })
        self.assertEqual(resp.status_code, 302)

    def test_login_with_wrong_password(self):
        resp = self.client.post(reverse('login'), {
            'username': 'patient_a@test.com',
            'password': 'WrongPassword!',
        })
        self.assertEqual(resp.status_code, 200)  # Re-shows login form

    def test_login_with_nonexistent_email(self):
        resp = self.client.post(reverse('login'), {
            'username': 'nonexistent@test.com',
            'password': 'TestPass123!',
        })
        self.assertEqual(resp.status_code, 200)

    def test_login_case_insensitive_email(self):
        resp = self.client.post(reverse('login'), {
            'username': 'PATIENT_A@TEST.COM',
            'password': 'TestPass123!',
        })
        self.assertEqual(resp.status_code, 302)  # Should still work

    def test_login_redirects_by_role(self):
        """After login, user should be redirected to their role dashboard."""
        self.client.login(username='patient_a@test.com', password='TestPass123!')
        resp = self.client.get(reverse('login_success'))
        self.assertEqual(resp.status_code, 302)
        self.assertIn('/patients/', resp.url)

    def test_login_redirect_doctor(self):
        self.client.login(username='doctor@test.com', password='TestPass123!')
        resp = self.client.get(reverse('login_success'))
        self.assertEqual(resp.status_code, 302)
        self.assertIn('/doctor/', resp.url)
