"""
Background management command to sync PACS images from Raditech.

Runs as a long-lived process that periodically checks for studies
missing their pacs_url and fetches image URLs from Raditech.

Usage:
    python3 manage.py sync_pacs_images          # Run continuously
    python3 manage.py sync_pacs_images --once   # Run one cycle only
"""
import time
import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from core.models import Study
from core.raditech_client import get_raditech_client, RaditechAPIError
from core.notifications import notify_images_available

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Sync PACS images from Raditech for studies awaiting images'

    def add_arguments(self, parser):
        parser.add_argument(
            '--once',
            action='store_true',
            help='Run a single sync cycle and exit (useful for testing)',
        )
        parser.add_argument(
            '--interval',
            type=int,
            default=None,
            help='Override sync interval in seconds (default: from settings)',
        )

    def handle(self, *args, **options):
        run_once = options['once']
        interval = options['interval'] or getattr(settings, 'RADITECH_SYNC_INTERVAL', 300)

        self.stdout.write(self.style.SUCCESS(
            f'PACS Image Sync started (interval: {interval}s, mode: {"once" if run_once else "continuous"})'
        ))

        while True:
            try:
                synced = self._sync_cycle()
                if synced > 0:
                    self.stdout.write(self.style.SUCCESS(
                        f'Synced {synced} study/studies with PACS images'
                    ))
                else:
                    self.stdout.write('No pending studies to sync')
            except Exception as e:
                logger.error('Error during PACS sync cycle: %s', e, exc_info=True)
                self.stdout.write(self.style.ERROR(f'Sync error: {e}'))

            if run_once:
                break

            self.stdout.write(f'Sleeping {interval}s until next cycle...')
            time.sleep(interval)

    def _sync_cycle(self):
        """
        Execute one sync cycle:
        1. Find all studies with empty pacs_url and a valid accession_number.
        2. Group by patient MRN.
        3. Fetch reports from Raditech for each patient.
        4. Match reports to studies and update pacs_url.
        """
        # Studies that have been scheduled on Raditech but don't have images yet
        pending_studies = Study.objects.filter(
            pacs_url='',
            accession_number__isnull=False,
        ).exclude(
            accession_number=''
        ).select_related('id_patient')

        if not pending_studies.exists():
            return 0

        client = get_raditech_client()
        synced_count = 0

        # Group studies by patient MRN to minimize API calls
        patient_studies = {}
        for study in pending_studies:
            mrn = study.id_patient.mrn
            if mrn:
                if mrn not in patient_studies:
                    patient_studies[mrn] = []
                patient_studies[mrn].append(study)

        for mrn, studies in patient_studies.items():
            try:
                reports = client.get_reports(mrn)
            except RaditechAPIError as e:
                logger.warning('Failed to get reports for MRN=%s: %s', mrn, e)
                continue

            if not reports:
                continue

            # Build a lookup by accession number from the Raditech response
            report_by_accession = {}
            for report in reports:
                acc = report.get("entityid") or report.get("accessionNo")
                if acc:
                    report_by_accession[acc] = report

            for study in studies:
                report = report_by_accession.get(study.accession_number)
                if report and report.get("sharedurl"):
                    study.pacs_url = report["sharedurl"]
                    study.save(update_fields=["pacs_url"])
                    synced_count += 1

                    self.stdout.write(self.style.SUCCESS(
                        f'  ✓ Study {study.id_study} (Accession: {study.accession_number}) '
                        f'→ pacs_url updated'
                    ))

                    # Send WebSocket notification
                    try:
                        notify_images_available(study)
                    except Exception as e:
                        logger.warning(
                            'Failed to send images_available notification for study %s: %s',
                            study.id_study, e
                        )

        return synced_count
