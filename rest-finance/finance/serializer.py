from rest_framework import serializers
from .models import Actif

Class ActifSerializer(serializers.ModelSerializer):
    class Meta:
        model = Actif
        fields = '__all__'