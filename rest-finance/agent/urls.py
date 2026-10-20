from django.urls import path
from . import views

urlpatterns = [
    path("analyze/",views.analyse, name="analyze"),
]