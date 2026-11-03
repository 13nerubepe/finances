from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import ConnexionSerializer, InscriptionSerializer, UserSerializer

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


class CurrentLogUserView(generics.RetrieveAPIView):

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user