from django.conf import settings
from django.db.models import Count, Prefetch
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status, viewsets
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import Portefeuille, Position
from .serializers import (
    AjoutActifSerializer,
    ChangerMotDePasseSerializer,
    ConnexionSerializer,
    InscriptionSerializer,
    ModifierProfilSerializer,
    PortefeuilleDetailSerializer,
    PortefeuilleSerializer,
    PositionSerializer,
    UserSerializer,
)

COOKIE_REFRESH = "refresh_token"
CHEMIN_COOKIE = "/api/auth/"


def poser_cookie_refresh(response, token):
    response.set_cookie(
        COOKIE_REFRESH,
        token,
        max_age=int(api_settings.REFRESH_TOKEN_LIFETIME.total_seconds()),
        httponly=True,
        secure=not settings.DEBUG,
        samesite="Lax",
        path=CHEMIN_COOKIE,
    )


class InscriptionView(generics.CreateAPIView):

    serializer_class = InscriptionSerializer
    permission_classes = [AllowAny]


class ConnexionView(TokenObtainPairView):
    """Renvoie le token d'accès et place le token de rafraîchissement dans un cookie httpOnly."""

    serializer_class = ConnexionSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        poser_cookie_refresh(response, response.data.pop("refresh"))
        return response


class RafraichirView(TokenRefreshView):
    """Lit le token de rafraîchissement dans le cookie."""

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data={"refresh": request.COOKIES.get(COOKIE_REFRESH, "")})

        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as erreur:
            raise InvalidToken(erreur.args[0])

        donnees = dict(serializer.validated_data)
        nouveau_refresh = donnees.pop("refresh", None)
        response = Response(donnees)

        if nouveau_refresh:
            poser_cookie_refresh(response, nouveau_refresh)
        return response


class DeconnexionView(APIView):
    """Invalide le cookie, même si le token d'accès a déjà expiré."""

    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(request=None, responses={205: None})
    def post(self, request):
        token = request.COOKIES.get(COOKIE_REFRESH)

        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass  # Déjà expiré

        response = Response(status=status.HTTP_205_RESET_CONTENT)
        response.delete_cookie(COOKIE_REFRESH, path=CHEMIN_COOKIE)
        return response


class CurrentLogUserView(generics.RetrieveUpdateAPIView):
    """Lit (GET) ou modifie (PATCH) le profil de l'utilisateur connecté."""

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        return ModifierProfilSerializer if self.request.method == "PATCH" else UserSerializer

    @extend_schema(request=ModifierProfilSerializer, responses=UserSerializer)
    def patch(self, request, *args, **kwargs):
        serializer = ModifierProfilSerializer(request.user, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class ChangerMotDePasseView(APIView):
    """Change le mot de passe, ferme les autres sessions et renouvelle celle-ci."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=ChangerMotDePasseSerializer, responses={200: None})
    def post(self, request):
        serializer = ChangerMotDePasseSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])

        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)

        response = Response({"message": "Mot de passe modifié."})
        poser_cookie_refresh(response, str(RefreshToken.for_user(user)))
        return response


def _mon_portefeuille(request, pk):
    """Renvoie le portefeuille s'il appartient à l'utilisateur connecté, sinon 404
    (on ne révèle pas l'existence des portefeuilles des autres)."""
    return get_object_or_404(Portefeuille.objects.filter(utilisateur=request.user), pk=pk)


class PortefeuilleViewSet(viewsets.ModelViewSet):
    """Portefeuilles de l'utilisateur connecté : liste, création, détail, modification, suppression."""

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    pagination_class = None  # un utilisateur a peu de portefeuilles

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # génération de la documentation
            return Portefeuille.objects.none()

        portefeuilles = Portefeuille.objects.filter(utilisateur=self.request.user).annotate(
            nb_actifs=Count("positions")
        )
        if self.action == "retrieve":
            positions = Position.objects.select_related("actif").order_by("actif__symbole")
            portefeuilles = portefeuilles.prefetch_related(Prefetch("positions", queryset=positions))
        return portefeuilles.order_by("nom")

    def get_serializer_class(self):
        return PortefeuilleDetailSerializer if self.action == "retrieve" else PortefeuilleSerializer

    def perform_create(self, serializer):
        serializer.save(utilisateur=self.request.user)


class AjoutActifView(generics.GenericAPIView):
    """Ajoute un actif (et sa quantité facultative) dans un portefeuille."""

    permission_classes = [IsAuthenticated]
    serializer_class = AjoutActifSerializer

    def post(self, request, pk):
        portefeuille = _mon_portefeuille(request, pk)
        serializer = AjoutActifSerializer(data=request.data, context={"portefeuille": portefeuille})
        serializer.is_valid(raise_exception=True)
        position = serializer.save()
        return Response(PositionSerializer(position).data, status=status.HTTP_201_CREATED)


class ActifDuPortefeuilleView(generics.GenericAPIView):
    """Modifie la quantité d'un actif du portefeuille (PATCH) ou le retire (DELETE)."""

    permission_classes = [IsAuthenticated]
    serializer_class = PositionSerializer
    http_method_names = ["patch", "delete", "head", "options"]

    def _position(self, request, pk, symbole):
        portefeuille = _mon_portefeuille(request, pk)
        positions = Position.objects.select_related("actif")
        return get_object_or_404(positions, portefeuille=portefeuille, actif__symbole__iexact=symbole)

    def patch(self, request, pk, symbole):
        position = self._position(request, pk, symbole)
        serializer = PositionSerializer(position, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk, symbole):
        self._position(request, pk, symbole).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
