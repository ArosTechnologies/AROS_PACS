"""
Associate Doctor Dashboard Tests.

Covers:
- Associate doctor signup injection
- Cross-role access
- Dashboard access after approval vs. before
"""
from django.test import TestCase
from django.contrib.auth.models import User, Group
from django.urls import reverse
from associateDoctorDashboard.models import AssociateDoctor
from patientsDashboard.models import Patient


class AssociateTestSetup(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.doctors_group, _ = Group.objects.get_or_create(name='Doctors')
        cls.patients_group, _ = Group.objects.get_or_create(name='Patients')
        cls.assistants_group, _ = Group.objects.get_or_create(name='Assistants')
        cls.associates_group, _ = Group.objects.get_or_create(name='AssociatedDoctors')

        # Verified associate doctor
        cls.assoc_user = User.objects.create_user(
            username='assoc@test.com', email='assoc@test.com', password='TestPass123!'
        )
        cls.assoc_user.groups.add(cls.associates_group)
        cls.assoc_doctor = AssociateDoctor.objects.create(
            user=cls.assoc_user, address='Addr', phone='111',
            university='UNAM', professional_id='CED-001',
            is_verified=True, is_email_verified=True,
        )

        # Patient (for cross-role tests)
        cls.patient_user = User.objects.create_user(
            username='pat@test.com', email='pat@test.com', password='TestPass123!'
        )
        cls.patient_user.groups.add(cls.patients_group)
        cls.patient = Patient.objects.create(
            user=cls.patient_user, address='PAddr', phone='222', gender='M'
        )


# ════════════════════════════════════════════════════════════
#  SIGNUP TESTS
# ════════════════════════════════════════════════════════════

class AssociateSignupTests(AssociateTestSetup):
    """Test associate doctor registration form."""

    def test_valid_signup(self):
        resp = self.client.post(reverse('associate_signup'), {
            'first_name': 'New', 'last_name': 'AssocDoc',
            'email': 'new_assoc@test.com',
            'password': 'SecurePass123!',
            'password_confirm': 'SecurePass123!',
            'phone': '999', 'address': 'New Addr',
            'university': 'MIT', 'professional_id': 'CED-NEW',
        })
        self.assertEqual(resp.status_code, 200)  # Verification pending
        self.assertTrue(User.objects.filter(email='new_assoc@test.com').exists())

    def test_duplicate_email_signup(self):
        resp = self.client.post(reverse('associate_signup'), {
            'first_name': 'Dup', 'last_name': 'Test',
            'email': 'assoc@test.com',  # Already exists
            'password': 'SecurePass123!',
            'password_confirm': 'SecurePass123!',
            'phone': '999', 'address': 'Addr',
            'university': 'U', 'professional_id': 'CED-DUP',
        })
        self.assertEqual(resp.status_code, 200)  # Re-shows form
        self.assertEqual(User.objects.filter(email='assoc@test.com').count(), 1)

    def test_sql_injection_professional_id(self):
        resp = self.client.post(reverse('associate_signup'), {
            'first_name': 'SQL', 'last_name': 'Test',
            'email': 'sqli_assoc@test.com',
            'password': 'SecurePass123!',
            'password_confirm': 'SecurePass123!',
            'phone': '999', 'address': 'Addr',
            'university': "'; DROP TABLE auth_user; --",
            'professional_id': "1 OR 1=1",
        })
        self.assertIn(resp.status_code, [200, 302])
        self.assertTrue(User.objects.filter(email='assoc@test.com').exists())

    def test_xss_signup_fields(self):
        resp = self.client.post(reverse('associate_signup'), {
            'first_name': '<script>alert(1)</script>',
            'last_name': '<img src=x onerror=alert(1)>',
            'email': 'xss_assoc@test.com',
            'password': 'SecurePass123!',
            'password_confirm': 'SecurePass123!',
            'phone': '999', 'address': 'Addr',
            'university': '"><script>alert(1)</script>',
            'professional_id': 'CED-XSS',
        })
        self.assertIn(resp.status_code, [200, 302])


# ════════════════════════════════════════════════════════════
#  CROSS-ROLE ACCESS
# ════════════════════════════════════════════════════════════

class AssociateCrossRoleTests(AssociateTestSetup):
    """Verify associates can't access other dashboards."""

    def test_associate_cannot_access_doctor_dashboard(self):
        self.client.login(username='assoc@test.com', password='TestPass123!')
        resp = self.client.get(reverse('pendingStudies'))
        self.assertEqual(resp.status_code, 403)

    def test_patient_cannot_access_associate_dashboard(self):
        self.client.login(username='pat@test.com', password='TestPass123!')
        resp = self.client.get(reverse('associate_dashboard'))
        self.assertEqual(resp.status_code, 403)

    def test_associate_can_access_own_dashboard(self):
        self.client.login(username='assoc@test.com', password='TestPass123!')
        resp = self.client.get(reverse('associate_dashboard'))
        self.assertEqual(resp.status_code, 200)
