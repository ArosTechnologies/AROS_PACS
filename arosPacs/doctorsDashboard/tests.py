"""
Doctor Dashboard Tests.

Covers:
- Study locking (lock_study API)
- Report creation (StudyReportCreateView)
- Logout cleanup (unlocking in-progress studies)
- Cross-role access to doctor endpoints
"""
from django.test import TestCase
from django.contrib.auth.models import User, Group
from django.urls import reverse
from core.models import Study, Report
from patientsDashboard.models import Patient
from doctorsDashboard.models import ReportingDoctor
from assistantDashboard.models import Assistant, StudyRequest
from datetime import date


class DoctorTestSetup(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.doctors_group, _ = Group.objects.get_or_create(name='Doctors')
        cls.patients_group, _ = Group.objects.get_or_create(name='Patients')
        cls.assistants_group, _ = Group.objects.get_or_create(name='Assistants')
        cls.associates_group, _ = Group.objects.get_or_create(name='AssociatedDoctors')

        # Doctor A
        cls.doctor_user_a = User.objects.create_user(
            username='doca@test.com', email='doca@test.com', password='TestPass123!',
            first_name='DocA', last_name='Test',
        )
        cls.doctor_user_a.groups.add(cls.doctors_group)
        cls.doctor_a = ReportingDoctor.objects.create(
            user=cls.doctor_user_a,
            address='Addr', phone='111', university='UNAM',
            professional_id='CED-A', specialty='Radiology'
        )

        # Doctor B
        cls.doctor_user_b = User.objects.create_user(
            username='docb@test.com', email='docb@test.com', password='TestPass123!',
            first_name='DocB', last_name='Test',
        )
        cls.doctor_user_b.groups.add(cls.doctors_group)
        cls.doctor_b = ReportingDoctor.objects.create(
            user=cls.doctor_user_b,
            address='Addr', phone='222', university='IPN',
            professional_id='CED-B', specialty='Radiology'
        )

        # Patient
        cls.patient_user = User.objects.create_user(
            username='pat@test.com', email='pat@test.com', password='TestPass123!'
        )
        cls.patient_user.groups.add(cls.patients_group)
        cls.patient = Patient.objects.create(
            user=cls.patient_user, address='PAddr', phone='333', gender='M'
        )

        # Study request (needed for Study FK)
        cls.study_request = StudyRequest.objects.create(
            id_patient=cls.patient,
            requested_study='TORAX_AP',
        )

        # Pending study (no report)
        cls.study_pending = Study.objects.create(
            pacs_url='https://example.com/pacs/1',
            email_sent=False, id_report=None, id_patient=cls.patient,
            date=date.today(), id_study_request=cls.study_request,
        )


# ════════════════════════════════════════════════════════════
#  STUDY LOCKING
# ════════════════════════════════════════════════════════════

class StudyLockTests(DoctorTestSetup):
    """Verify study locking behavior."""

    def test_doctor_can_lock_study(self):
        self.client.login(username='doca@test.com', password='TestPass123!')
        url = reverse('lockStudy', kwargs={'study_id': self.study_pending.pk})
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, 200)
        self.study_pending.refresh_from_db()
        self.assertIsNotNone(self.study_pending.id_report)
        self.assertEqual(self.study_pending.id_report.status, Report.IN_PROGRESS)

    def test_second_doctor_cannot_lock_already_locked_study(self):
        # Doctor A locks the study
        self.client.login(username='doca@test.com', password='TestPass123!')
        self.client.post(reverse('lockStudy', kwargs={'study_id': self.study_pending.pk}))
        self.client.logout()

        # Doctor B tries to lock the same study
        self.client.login(username='docb@test.com', password='TestPass123!')
        resp = self.client.post(reverse('lockStudy', kwargs={'study_id': self.study_pending.pk}))
        self.assertEqual(resp.status_code, 403)

    def test_patient_cannot_lock_study(self):
        self.client.login(username='pat@test.com', password='TestPass123!')
        url = reverse('lockStudy', kwargs={'study_id': self.study_pending.pk})
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, 403)

    def test_lock_nonexistent_study(self):
        self.client.login(username='doca@test.com', password='TestPass123!')
        url = reverse('lockStudy', kwargs={'study_id': 99999})
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, 404)

    def test_lock_study_sql_injection_id(self):
        """URL parameter is typed as int, so non-int should 404."""
        self.client.login(username='doca@test.com', password='TestPass123!')
        resp = self.client.post('/doctor/lockStudy/1%20OR%201=1/')
        self.assertEqual(resp.status_code, 404)


# ════════════════════════════════════════════════════════════
#  REPORT CREATION
# ════════════════════════════════════════════════════════════

class ReportCreationTests(DoctorTestSetup):
    """Verify report creation through the StudyReportCreateView."""

    def test_doctor_can_create_report(self):
        self.client.login(username='doca@test.com', password='TestPass123!')
        url = reverse('studyReportCreate', kwargs={'pk': self.study_pending.pk})
        resp = self.client.post(url, {
            'about': 'Torax PA',
            'patients_description': 'Male, 30 years',
            'findings': 'Normal findings',
            'conclusions': 'No abnormalities',
            'recommendations': 'Follow up in 6 months',
        })
        self.assertEqual(resp.status_code, 302)  # Redirect to pending
        self.study_pending.refresh_from_db()
        self.assertIsNotNone(self.study_pending.id_report)
        self.assertEqual(self.study_pending.id_report.status, Report.COMPLETED)

    def test_patient_cannot_create_report(self):
        self.client.login(username='pat@test.com', password='TestPass123!')
        url = reverse('studyReportCreate', kwargs={'pk': self.study_pending.pk})
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 403)


# ════════════════════════════════════════════════════════════
#  DOCTOR LOGOUT CLEANUP
# ════════════════════════════════════════════════════════════

class DoctorLogoutTests(DoctorTestSetup):
    """Verify logout unlocks in-progress studies."""

    def test_logout_unlocks_studies(self):
        # Lock a study
        self.client.login(username='doca@test.com', password='TestPass123!')
        self.client.post(reverse('lockStudy', kwargs={'study_id': self.study_pending.pk}))
        self.study_pending.refresh_from_db()
        self.assertIsNotNone(self.study_pending.id_report)

        # Logout
        resp = self.client.get(reverse('doctor_logout'))
        self.assertEqual(resp.status_code, 302)

        # Study should be unlocked
        self.study_pending.refresh_from_db()
        self.assertIsNone(self.study_pending.id_report)
