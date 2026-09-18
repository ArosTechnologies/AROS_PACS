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
        if hasattr(user, 'role') and user.role:
            if user.role.name == 'Médico Asociado':
                groups.append(f"physician_{user.id}_agenda")
            elif user.role.name == 'Paciente':
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
