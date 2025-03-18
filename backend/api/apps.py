from django.apps import AppConfig
from backend.utils.neo4j import driver


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        import atexit
        atexit.register(driver.close)
        import api.signals