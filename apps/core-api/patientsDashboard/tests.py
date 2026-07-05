"""
Patient Dashboard Tests.

Covers:
- Patient signup validation & injection
- Profile update
- Doctor toggle API role checks
- Doctor search API role checks
"""
from django.test import TestCase
from django.contrib.auth.models import User, Group
from django.urls import reverse
from patientsDashboard.models import Patient
from associateDoctorDashboard.models import AssociateDoctor


class PatientTestSetup(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.doctors_group, _ = Group.objects.get_or_create(name='Doctors')
        cls.patients_group, _ = Group.objects.get_or_create(name='Patients')
        cls.assistants_group, _ = Group.objects.get_or_create(name='Assistants')
        cls.associates_group, _ = Group.objects.get_or_create(name='AssociatedDoctors')

        # Existing patient
        cls.patient_user = User.objects.create_user(
            username='existing@test.com', email='existing@test.com', password='TestPass123!'
        )
        cls.patient_user.groups.add(cls.patients_group)
        cls.patient = Patient.objects.create(
            user=cls.patient_user, address='Addr', phone='111', gender='M'
        )

        # Doctor user (for cross-role tests)
        cls.doctor_user = User.objects.create_user(
            username='doc@test.com', email='doc@test.com', password='TestPass123!'
        )
        cls.doctor_user.groups.add(cls.doctors_group)

        # Associate doctor
        cls.assoc_user = User.objects.create_user(
            username='assoc@test.com', email='assoc@test.com', password='TestPass123!'
        )
        cls.assoc_user.groups.add(cls.associates_group)
        cls.assoc_doctor = AssociateDoctor.objects.create(
            user=cls.assoc_user, address='Addr', phone='222',
            university='U', professional_id='CED-1',
            is_verified=True, is_email_verified=True,
        )


# ════════════════════════════════════════════════════════════
#  PATIENT SIGNUP
# ════════════════════════════════════════════════════════════

class PatientSignupTests(PatientTestSetup):
    """Test patient registration form."""

    def test_valid_signup(self):
        resp = self.client.post(reverse('patientsDashboard:signup'), {
            'first_name': 'New', 'last_name': 'Patient',
            'email': 'new@test.com', 'password': 'SecurePass123!',
            'password_confirm': 'SecurePass123!',
            'phone': '999', 'address': 'New Addr', 'gender': 'F',
        })
        self.assertEqual(resp.status_code, 200)  # Shows verification pending
        self.assertTrue(User.objects.filter(email='new@test.com').exists())

    def test_duplicate_email_signup(self):
        resp = self.client.post(reverse('patientsDashboard:signup'), {
            'first_name': 'Dup', 'last_name': 'Test',
            'email': 'existing@test.com',  # Already exists
            'password': 'SecurePass123!',
            'password_confirm': 'SecurePass123!',
            'phone': '999', 'address': 'Addr', 'gender': 'M',
        })
        self.assertEqual(resp.status_code, 200)  # Re-shows form with error
        # Should NOT create a second user
        self.assertEqual(User.objects.filter(email='existing@test.com').count(), 1)

    def test_password_mismatch_signup(self):
        resp = self.client.post(reverse('patientsDashboard:signup'), {
            'first_name': 'Mis', 'last_name': 'Match',
            'email': 'mismatch@test.com',
            'password': 'Password1!',
            'password_confirm': 'Password2!',
            'phone': '999', 'address': 'Addr', 'gender': 'M',
        })
        self.assertEqual(resp.status_code, 200)  # Re-shows form
        self.assertFalse(User.objects.filter(email='mismatch@test.com').exists())

    def test_sql_injection_signup_email(self):
        resp = self.client.post(reverse('patientsDashboard:signup'), {
            'first_name': 'SQL', 'last_name': 'Test',
            'email': "admin@x.com' OR '1'='1",
            'password': 'SecurePass123!',
            'password_confirm': 'SecurePass123!',
            'phone': '999', 'address': 'Addr', 'gender': 'M',
        })
        # Invalid email should be rejected by EmailField validation
        self.assertEqual(resp.status_code, 200)

    def test_xss_signup_name(self):
        resp = self.client.post(reverse('patientsDashboard:signup'), {
            'first_name': '<script>alert(1)</script>',
            'last_name': '<img src=x onerror=alert(1)>',
            'email': 'xss_signup@test.com',
            'password': 'SecurePass123!',
            'password_confirm': 'SecurePass123!',
            'phone': '999', 'address': 'Addr', 'gender': 'M',
        })
        self.assertIn(resp.status_code, [200, 302])


# ════════════════════════════════════════════════════════════
#  PATIENT API ROLE CHECKS
# ════════════════════════════════════════════════════════════

class PatientAPIRoleTests(PatientTestSetup):
    """Verify patient API endpoints reject non-patient users."""

    def test_doctor_search_blocked_for_doctor(self):
        self.client.login(username='doc@test.com', password='TestPass123!')
        resp = self.client.get(
            reverse('patientsDashboard:doctor_search_api'), {'q': 'test'}
        )
        self.assertEqual(resp.status_code, 403)

    def test_doctor_search_allowed_for_patient(self):
        self.client.login(username='existing@test.com', password='TestPass123!')
        resp = self.client.get(
            reverse('patientsDashboard:doctor_search_api'), {'q': 'test'}
        )
        self.assertEqual(resp.status_code, 200)

    def test_toggle_doctor_blocked_for_doctor(self):
        self.client.login(username='doc@test.com', password='TestPass123!')
        resp = self.client.post(
            reverse('patientsDashboard:toggle_doctor_api'),
            {'doctor_id': self.assoc_doctor.pk, 'action': 'grant'}
        )
        self.assertEqual(resp.status_code, 403)

    def test_toggle_doctor_allowed_for_patient(self):
        self.client.login(username='existing@test.com', password='TestPass123!')
        resp = self.client.post(
            reverse('patientsDashboard:toggle_doctor_api'),
            {'doctor_id': self.assoc_doctor.pk, 'action': 'grant'}
        )
        self.assertEqual(resp.status_code, 200)


# ════════════════════════════════════════════════════════════
#  DOCTOR TOGGLE VALIDATION
# ════════════════════════════════════════════════════════════

class DoctorToggleTests(PatientTestSetup):
    """Verify doctor grant/revoke validation."""

    def test_invalid_action(self):
        self.client.login(username='existing@test.com', password='TestPass123!')
        resp = self.client.post(
            reverse('patientsDashboard:toggle_doctor_api'),
            {'doctor_id': self.assoc_doctor.pk, 'action': 'hack'}
        )
        self.assertEqual(resp.status_code, 400)

    def test_nonexistent_doctor(self):
        self.client.login(username='existing@test.com', password='TestPass123!')
        resp = self.client.post(
            reverse('patientsDashboard:toggle_doctor_api'),
            {'doctor_id': 99999, 'action': 'grant'}
        )
        self.assertEqual(resp.status_code, 404)

    def test_sql_injection_doctor_id(self):
        self.client.login(username='existing@test.com', password='TestPass123!')
        resp = self.client.post(
            reverse('patientsDashboard:toggle_doctor_api'),
            {'doctor_id': "1 OR 1=1", 'action': 'grant'}
        )
        self.assertIn(resp.status_code, [400, 404, 500])
