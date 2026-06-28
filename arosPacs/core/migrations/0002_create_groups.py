from django.db import migrations

def create_groups(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    group_names = ['Doctors', 'Patients', 'Assistants', 'AssociatedDoctors']
    for name in group_names:
        Group.objects.get_or_create(name=name)

def remove_groups(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    group_names = ['Doctors', 'Patients', 'Assistants', 'AssociatedDoctors']
    for name in group_names:
        Group.objects.filter(name=name).delete()

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
        ('auth', '0001_initial'), # Ensure auth app is ready
    ]

    operations = [
        migrations.RunPython(create_groups, remove_groups),
    ]
