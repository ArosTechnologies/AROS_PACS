import json
from channels.generic.websocket import JsonWebsocketConsumer
from asgiref.sync import async_to_sync


class NotificationConsumer(JsonWebsocketConsumer):
    """
    WebSocket consumer for real-time notifications.
    Determines the user's role on connect and joins the appropriate channel group.
    
    Groups:
        - doctor_{user_id}     — Reporting doctors
        - doctors_all          — All reporting doctors (shared)
        - assistant_all        — All assistants (shared group)
        - patient_{user_id}    — Individual patients
        - associate_{user_id}  — Associate doctors
    """

    def connect(self):
        self.user = self.scope["user"]

        if self.user.is_anonymous:
            self.close()
            return

        # Determine role and join appropriate group(s)
        self.groups_joined = []

        if hasattr(self.user, 'reporting_doctor_profile'):
            group = f'doctor_{self.user.id}'
            self.groups_joined.append(group)
            # Also join shared doctor group for broadcast to all doctors
            self.groups_joined.append('doctors_all')

        if hasattr(self.user, 'assistant_profile'):
            self.groups_joined.append('assistant_all')

        if hasattr(self.user, 'patient_profile'):
            group = f'patient_{self.user.id}'
            self.groups_joined.append(group)

        if hasattr(self.user, 'associate_doctor_profile'):
            group = f'associate_{self.user.id}'
            self.groups_joined.append(group)

        for group in self.groups_joined:
            async_to_sync(self.channel_layer.group_add)(group, self.channel_name)

        self.accept()

    def disconnect(self, close_code):
        for group in getattr(self, 'groups_joined', []):
            async_to_sync(self.channel_layer.group_discard)(group, self.channel_name)

    def send_notification(self, event):
        """
        Handler for 'send_notification' type messages.
        Forwards the notification payload to the WebSocket client.
        """
        self.send_json({
            'type': event.get('notification_type', 'info'),
            'message': event.get('message', ''),
            'data': event.get('data', {}),
        })
