from django.shortcuts import render

from rest_framework.viewsets import ModelViewSet
from .models import Actif
from .serializers import ActifSerializer

# creation des api views
# Create your views here.

Class ActifViewSet(viewsets.ModelViewSet):
# DRF attend la propriété standard queryset
    queryset = Actif.objects.all()
    serializer_class = ActifSerializer
