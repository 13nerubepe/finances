from django.shortcuts import render

# Create your views here.
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import (
    ConnexionSerializer,
    DeconnexionSerializer,
    InscriptionSerializer,
    UserSerializer,
)


class InscriptionView(generics.CreateAPIView):

    serializer_class = InscriptionSerializer
    permission_classes = [AllowAny]


class ConnexionView(TokenObtainPairView):

    serializer_class = ConnexionSerializer


class DeconnexionView(generics.GenericAPIView):

    serializer_class = DeconnexionSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            RefreshToken(serializer.validated_data["refresh"]).blacklist()
        except TokenError:
            return Response(
                {"detail": "Ce token est invalide ou a déjà expiré"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_205_RESET_CONTENT)


class CurrentLogUserView(generics.RetrieveAPIView):

    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user