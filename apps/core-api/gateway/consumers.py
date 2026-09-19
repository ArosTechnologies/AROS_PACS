import json
from channels.generic.websocket import AsyncWebsocketConsumer

from channels.db import database_sync_to_async

@database_sync_to_async
def get_user_groups(user):
    groups = []
    if hasattr(user, 'staff_profile'):
        try:
            profile = user.staff_profile
            if profile and hasattr(profile, 'clinic') and profile.clinic:
                groups.append(f"clinic_{profile.clinic.slug}_agenda")
        except:
            pass
            
    try:
        if hasattr(user, 'patient_profile'):
            groups.append(f"patient_{user.id}")
            groups.append(f"patient_{user.id}_agenda")
            
        if hasattr(user, 'staff_profile') and (hasattr(user, 'role') and user.role and user.role.name in ['Médico Asociado', 'Associate Doctor']):
            groups.append(f"physician_{user.id}_agenda")
            groups.append(f"associate_{user.id}")
            
        # Fallback for old role checking
        if hasattr(user, 'role') and user.role:
            if user.role.name == 'Médico Asociado' and f"physician_{user.id}_agenda" not in groups:
                groups.append(f"physician_{user.id}_agenda")
                groups.append(f"associate_{user.id}")
            elif user.role.name == 'Paciente' and f"patient_{user.id}" not in groups:
                groups.append(f"patient_{user.id}")
                groups.append(f"patient_{user.id}_agenda")
    except:
        pass
    return groups

class NotificationsConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close()
            return
            
        await self.accept()

        self.user_groups = await get_user_groups(user)
        for group in self.user_groups:
            await self.channel_layer.group_add(group, self.channel_name)

    async def disconnect(self, close_code):
        for group in getattr(self, 'user_groups', []):
            await self.channel_layer.group_discard(group, self.channel_name)

    # Receive message from channel layer
    async def appointment_update(self, event):
        payload = event.get('appointment', {})
        await self.send(text_data=json.dumps({
            'type': 'appointment_update',
            'data': payload
        }))

    async def consent_revoked(self, event):
        payload = event.get('data', {})
        await self.send(text_data=json.dumps({
            'type': 'consent_revoked',
            'data': payload
        }))

    async def consent_granted(self, event):
        payload = event.get('data', {})
        await self.send(text_data=json.dumps({
            'type': 'consent_granted',
            'data': payload
        }))

    async def report_completed(self, event):
        payload = event.get('data', {})
        await self.send(text_data=json.dumps({
            'type': 'report_completed',
            'data': payload
        }))

    async def new_study(self, event):
        payload = event.get('data', {})
        await self.send(text_data=json.dumps({
            'type': 'new_study',
            'data': payload
        }))

    async def report_locked(self, event):
        payload = event.get('data', {})
        await self.send(text_data=json.dumps({
            'type': 'report_locked',
            'data': payload
        }))

    async def studies_unlocked(self, event):
        payload = event.get('data', {})
        await self.send(text_data=json.dumps({
            'type': 'studies_unlocked',
            'data': payload
        }))

    async def images_available(self, event):
        payload = event.get('data', {})
        await self.send(text_data=json.dumps({
            'type': 'images_available',
            'data': payload
        }))

    async def study_request_created(self, event):
        payload = event.get('data', {})
        await self.send(text_data=json.dumps({
            'type': 'study_request_created',
            'data': payload
        }))

    async def new_appointment(self, event):
        payload = event.get('data', {})
        await self.send(text_data=json.dumps({
            'type': 'new_appointment',
            'data': payload
        }))

    async def appointment_status_changed(self, event):
        payload = event.get('data', {})
        await self.send(text_data=json.dumps({
            'type': 'appointment_status_changed',
            'data': payload
        }))

    async def doctor_pending_approval(self, event):
        payload = event.get('data', {})
        await self.send(text_data=json.dumps({
            'type': 'doctor_pending_approval',
            'data': payload
        }))

    async def doctor_approved(self, event):
        payload = event.get('data', {})
        await self.send(text_data=json.dumps({
            'type': 'doctor_approved',
            'data': payload
        }))

    async def doctor_denied(self, event):
        payload = event.get('data', {})
        await self.send(text_data=json.dumps({
            'type': 'doctor_denied',
            'data': payload
        }))

