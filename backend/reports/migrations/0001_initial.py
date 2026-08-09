# reports app has no database models — it only provides CSV/summary export views.
# This empty migration exists so `makemigrations` reports no pending changes
# and the app is explicitly initialised in the migration graph.
from django.db import migrations


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = []
