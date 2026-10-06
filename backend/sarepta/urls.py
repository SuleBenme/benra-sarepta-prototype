from django.urls import path
from core.views import health, demo_content

urlpatterns = [
    path("api/health/", health),
    path("api/demo-content/", demo_content),
]
