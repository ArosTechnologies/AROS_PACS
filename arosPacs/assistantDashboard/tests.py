"""
Assistant Dashboard Tests.

Covers:
- API role-based access control (assistant_required decorator)
- Patient creation validation and injection
- Doctor verification flow
- Study request creation
"""
from django.test import TestCase, Client
from django.contrib.auth.models import User, Group
from django.urls import reverse
from patientsDashboard.models import Patient
from doctorsDashboard.models import ReportingDoctor
from associateDoctorDashboard.models import AssociateDoctor
from assistantDashboard.models import StudyRequest, Assistant
import json


class AssistantTestSetup(TestCase):
    """Shared setup for assistant-specific tests."""

    @classmethod
    def setUpTestData(cls):
        cls.doctors_group, _ = Group.objects.get_or_create(name='Doctors')
        cls.patients_group, _ = Group.objects.get_or_create(name='Patients')
        cls.assistants_group, _ = Group.objects.get_or_create(name='Assistants')
        cls.associates_group, _ = Group.objects.get_or_create(name='AssociatedDoctors')

        # Assistant
        cls.assistant_user = User.objects.create_user(
            username='asst@test.com', email='asst@test.com', password='TestPass123!'
        )
        cls.assistant_user.groups.add(cls.assistants_group)
        cls.assistant = Assistant.objects.create(
            user=cls.assistant_user, address='Addr', phone='555'
        )

        # Patient (non-assistant user for cross-role tests)
        cls.patient_user = User.objects.create_user(
            username='pat@test.com', email='pat@test.com', password='TestPass123!'
        )
        cls.patient_user.groups.add(cls.patients_group)
        cls.patient = Patient.objects.create(
            user=cls.patient_user, address='PAddr', phone='111', gender='M'
        )

        # Doctor (non-assistant user for cross-role tests)
        cls.doctor_user = User.objects.create_user(
            username='doc@test.com', email='doc@test.com', password='TestPass123!'
        )
        cls.doctor_user.groups.add(cls.doctors_group)

        # Associate doctor pending approval
        cls.pending_assoc_user = User.objects.create_user(
            username='pending@test.com', email='pending@test.com', password='TestPass123!',
            is_active=False,
        )
        cls.pending_assoc_user.groups.add(cls.associates_group)
        cls.pending_assoc = AssociateDoctor.objects.create(
            user=cls.pending_assoc_user, address='Addr', phone='666',
            university='Test U', professional_id='PND-001',
            is_verified=False, is_email_verified=True,
        )


# ════════════════════════════════════════════════════════════
#  API ROLE CHECKS
# ════════════════════════════════════════════════════════════

class AssistantAPIRoleTests(AssistantTestSetup):
    """Verify that assistant API endpoints reject non-assistant users."""

    def test_patient_search_blocked_for_patient(self):
        self.client.login(username='pat@test.com', password='TestPass123!')
        resp = self.client.get(reverse('patient_search_api'), {'q': 'test'})
        self.assertEqual(resp.status_code, 403)

    def test_patient_search_blocked_for_doctor(self):
        self.client.login(username='doc@test.com', password='TestPass123!')
        resp = self.client.get(reverse('patient_search_api'), {'q': 'test'})
        self.assertEqual(resp.status_code, 403)

    def test_patient_search_allowed_for_assistant(self):
        self.client.login(username='asst@test.com', password='TestPass123!')
        resp = self.client.get(reverse('patient_search_api'), {'q': 'test'})
        self.assertEqual(resp.status_code, 200)

    def test_create_patient_blocked_for_patient(self):
        self.client.login(username='pat@test.com', password='TestPass123!')
        resp = self.client.post(reverse('create_patient_api'), {
            'first_name': 'Hack', 'last_name': 'Attempt',
            'email': 'hack@test.com', 'phone': '999',
        })
        self.assertEqual(resp.status_code, 403)

    def test_create_patient_blocked_for_doctor(self):
        self.client.login(username='doc@test.com', password='TestPass123!')
        resp = self.client.post(reverse('create_patient_api'), {
            'first_name': 'Hack', 'last_name': 'Attempt',
            'email': 'hack@test.com', 'phone': '999',
        })
        self.assertEqual(resp.status_code, 403)

    def test_verify_doctor_blocked_for_patient(self):
        self.client.login(username='pat@test.com', password='TestPass123!')
        resp = self.client.post(reverse('verify_doctor_api'), {
            'doctor_id': self.pending_assoc.pk, 'action': 'approve',
        })
        self.assertEqual(resp.status_code, 403)

    def test_verify_doctor_blocked_for_doctor(self):
        self.client.login(username='doc@test.com', password='TestPass123!')
        resp = self.client.post(reverse('verify_doctor_api'), {
            'doctor_id': self.pending_assoc.pk, 'action': 'approve',
        })
        self.assertEqual(resp.status_code, 403)


# ════════════════════════════════════════════════════════════
#  PATIENT CREATION INJECTION
# ════════════════════════════════════════════════════════════

class PatientCreationTests(AssistantTestSetup):
    """Test patient creation validation and injection handling."""

    def test_create_patient_valid(self):
        self.client.login(username='asst@test.com', password='TestPass123!')
        resp = self.client.post(reverse('create_patient_api'), {
            'first_name': 'Valid', 'last_name': 'Patient',
            'email': 'valid@test.com', 'phone': '123',
        })
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.content)
        self.assertTrue(data['success'])

    def test_create_patient_missing_fields(self):
        self.client.login(username='asst@test.com', password='TestPass123!')
        resp = self.client.post(reverse('create_patient_api'), {
            'first_name': '', 'last_name': '',
            'email': '', 'phone': '',
        })
        self.assertEqual(resp.status_code, 400)

    def test_create_patient_duplicate_email(self):
        self.client.login(username='asst@test.com', password='TestPass123!')
        resp = self.client.post(reverse('create_patient_api'), {
            'first_name': 'Dup', 'last_name': 'Test',
            'email': 'pat@test.com', 'phone': '123',  # Already exists
        })
        self.assertEqual(resp.status_code, 400)

    def test_create_patient_sql_injection_email(self):
        self.client.login(username='asst@test.com', password='TestPass123!')
        resp = self.client.post(reverse('create_patient_api'), {
            'first_name': "'; DROP TABLE auth_user; --",
            'last_name': 'Normal',
            'email': 'sqli@test.com',
            'phone': '123',
        })
        # Should either succeed (SQL is harmless in ORM) or fail validation
        self.assertIn(resp.status_code, [200, 400])
        # Verify users table still exists
        self.assertTrue(User.objects.exists())

    def test_create_patient_xss_in_name(self):
        self.client.login(username='asst@test.com', password='TestPass123!')
        resp = self.client.post(reverse('create_patient_api'), {
            'first_name': '<script>alert(1)</script>',
            'last_name': '<img src=x onerror=alert(1)>',
            'email': 'xss_patient@test.com',
            'phone': '123',
        })
        self.assertIn(resp.status_code, [200, 400])


# ════════════════════════════════════════════════════════════
#  DOCTOR VERIFICATION
# ════════════════════════════════════════════════════════════

class DoctorVerificationTests(AssistantTestSetup):
    """Test the doctor approve/deny flow."""

    def test_approve_doctor(self):
        self.client.login(username='asst@test.com', password='TestPass123!')
        resp = self.client.post(reverse('verify_doctor_api'), {
            'doctor_id': self.pending_assoc.pk, 'action': 'approve',
        })
        self.assertEqual(resp.status_code, 200)
        self.pending_assoc.refresh_from_db()
        self.assertTrue(self.pending_assoc.is_verified)

    def test_invalid_action(self):
        self.client.login(username='asst@test.com', password='TestPass123!')
        resp = self.client.post(reverse('verify_doctor_api'), {
            'doctor_id': self.pending_assoc.pk, 'action': 'hack',
        })
        self.assertEqual(resp.status_code, 400)

    def test_nonexistent_doctor_id(self):
        self.client.login(username='asst@test.com', password='TestPass123!')
        resp = self.client.post(reverse('verify_doctor_api'), {
            'doctor_id': 99999, 'action': 'approve',
        })
        self.assertEqual(resp.status_code, 404)

    def test_verify_doctor_sql_injection_id(self):
        self.client.login(username='asst@test.com', password='TestPass123!')
        resp = self.client.post(reverse('verify_doctor_api'), {
            'doctor_id': "1 OR 1=1", 'action': 'approve',
        })
        # Should fail gracefully — DoesNotExist or ValueError
        self.assertIn(resp.status_code, [400, 404, 500])
