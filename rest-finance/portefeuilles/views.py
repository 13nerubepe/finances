from django.shortcuts import render

# Create your views here.
from django.db.models import Count, Prefetch
from rest_framework import generics, status, viewsets
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response

from .models import Portefeuille, PortefeuilleActif
from .serializers import (
    AjoutActifSerializer,
    LigneSerializer,
    PortefeuilleDetailSerializer,
    PortefeuilleSerializer,
)


def _mon_portefeuille(request, pk):
    """Renvoie le portefeuille s'il appartient à l'utilisateur connecté, sinon 404
    (on ne révèle pas l'existence des portefeuilles des autres)."""
    return get_object_or_404(Portefeuille.objects.filter(proprietaire=request.user), pk=pk)


class PortefeuilleViewSet(viewsets.ModelViewSet):
    "Portefeuilles de l'utilisateur connecté : liste, création, détail, renommage, suppression"

    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    pagination_class = None  # un utilisateur a peu de portefeuilles

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # génération de la documentation
            return Portefeuille.objects.none()

        portefeuilles = Portefeuille.objects.filter(proprietaire=self.request.user).annotate(
            nb_actifs=Count("lignes")
        )
        if self.action == "retrieve":
            lignes = PortefeuilleActif.objects.select_related("actif").order_by("actif__symbole")
            portefeuilles = portefeuilles.prefetch_related(Prefetch("lignes", queryset=lignes))
        return portefeuilles.order_by("nom")

    def get_serializer_class(self):
        return PortefeuilleDetailSerializer if self.action == "retrieve" else PortefeuilleSerializer

    def perform_create(self, serializer):
        serializer.save(proprietaire=self.request.user)


class AjoutActifView(generics.GenericAPIView):
    "Ajoute un actif dans un portefeuille"

    serializer_class = AjoutActifSerializer

    def post(self, request, pk):
        portefeuille = _mon_portefeuille(request, pk)
        serializer = AjoutActifSerializer(
            data=request.data, context={"portefeuille": portefeuille}
        )
        serializer.is_valid(raise_exception=True)
        ligne = serializer.save()
        return Response(LigneSerializer(ligne).data, status=status.HTTP_201_CREATED)


class ActifDuPortefeuilleView(generics.GenericAPIView):
    "Modifie la quantité d'un actif du portefeuille (PATCH) ou le retire (DELETE)"

    serializer_class = LigneSerializer
    http_method_names = ["patch", "delete", "head", "options"]

    def _ligne(self, request, pk, symbole):
        portefeuille = _mon_portefeuille(request, pk)
        lignes = PortefeuilleActif.objects.select_related("actif")
        return get_object_or_404(lignes, portefeuille=portefeuille, actif__symbole__iexact=symbole)

    def patch(self, request, pk, symbole):
        ligne = self._ligne(request, pk, symbole)
        serializer = LigneSerializer(ligne, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk, symbole):
        self._ligne(request, pk, symbole).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)