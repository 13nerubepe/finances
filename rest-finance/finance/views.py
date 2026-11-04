from django.shortcuts import render

# Create your views here.
from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.generics import get_object_or_404
from rest_framework.decorators import action

from marches.models import Actif
from .models import Portefeuille,Position

from .serializers import (
    ConnexionSerializer,
    DeconnexionSerializer,
    InscriptionSerializer,
    UserSerializer,
    PositionSerializer,
    PortefeuilleSerializer
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
    permission_classes = [IsAuthenticated]


    def get_object(self):
        return self.request.user

class PortefeuilleViewSet(viewsets.ModelViewSet):
    """Portefeuilles de l'utilisateur connecté (il ne voit jamais ceux des autres)."""

    serializer_class = PortefeuilleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Portefeuille.objects.filter(utilisateur=self.request.user).prefetch_related("actifs")

    def perform_create(self, serializer):
        serializer.save(utilisateur=self.request.user)

    def _actif_demande(self, request):
        serializer = PositionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return get_object_or_404(Actif, symbole=serializer.validated_data["symbole"].upper())

    @action(detail=True, methods=["post"], url_path="ajouter-actif", serializer_class=PositionSerializer)
    def ajouter_actif(self, request, pk=None):
        portefeuille = self.get_object()
        Position.objects.get_or_create(portefeuille=portefeuille, actif=self._actif_demande(request))
        return Response(PortefeuilleSerializer(self.get_object()).data)

    @action(detail=True, methods=["post"], url_path="retirer-actif", serializer_class=PositionSerializer)
    def retirer_actif(self, request, pk=None):
        portefeuille = self.get_object()
        Position.objects.filter(portefeuille=portefeuille, actif=self._actif_demande(request)).delete()
        return Response(PortefeuilleSerializer(self.get_object()).data)
