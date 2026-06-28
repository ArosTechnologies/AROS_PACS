"""
Management command to fetch the full catalog of modalities and procedures
from the Raditech API. Used to build the study type mapping.

Usage:
    python3 manage.py fetch_raditech_catalog
"""
from django.core.management.base import BaseCommand
from core.raditech_client import get_raditech_client, RaditechAPIError


class Command(BaseCommand):
    help = 'Fetch modalities and procedures from the Raditech PACS/RIS API'

    def handle(self, *args, **options):
        client = get_raditech_client()

        try:
            self.stdout.write('Authenticating with Raditech...')
            session = client.start_session()
            self.stdout.write(self.style.SUCCESS(
                f'Authenticated as: {session.get("UserName")}'
            ))

            self.stdout.write('\nFetching modalities...')
            modalities = client.get_modalities()

            if not modalities:
                self.stdout.write(self.style.WARNING(
                    'No modalities returned. The data array was empty.'
                ))
                self.stdout.write('This may be normal for the demo environment.')
                return

            for mod in modalities:
                mod_id = mod.get('value') or mod.get('_id') or mod.get('id')
                mod_label = mod.get('label') or mod.get('Name') or str(mod)
                self.stdout.write(f'\n{"="*60}')
                self.stdout.write(self.style.SUCCESS(
                    f'Modality: {mod_label} (ID: {mod_id})'
                ))

                if mod_id:
                    self.stdout.write(f'  Fetching procedures for {mod_label}...')
                    try:
                        procedures = client.get_procedures(mod_id)
                        if isinstance(procedures, list):
                            for proc in procedures:
                                self.stdout.write(
                                    f'    - {proc.get("label", "?")} '
                                    f'(ID: {proc.get("value", "?")})'
                                )
                        elif isinstance(procedures, dict) and procedures.get('data'):
                            for proc in procedures['data']:
                                self.stdout.write(
                                    f'    - {proc.get("label", "?")} '
                                    f'(ID: {proc.get("value", "?")})'
                                )
                        else:
                            self.stdout.write(f'    Raw response: {procedures}')
                    except RaditechAPIError as e:
                        self.stdout.write(self.style.ERROR(
                            f'    Error fetching procedures: {e}'
                        ))

            self.stdout.write(f'\n{"="*60}')
            self.stdout.write(self.style.SUCCESS('Catalog fetch complete.'))

        except RaditechAPIError as e:
            self.stdout.write(self.style.ERROR(f'Raditech API error: {e}'))
