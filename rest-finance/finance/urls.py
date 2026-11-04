from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    ActifDuPortefeuilleView,
    AjoutActifView,
    ChangerMotDePasseView,
    ConnexionView,
    CurrentLogUserView,
    DeconnexionView,
    InscriptionView,
    PortefeuilleViewSet,
    RafraichirView,
)

router = SimpleRouter()
router.register("portefeuilles", PortefeuilleViewSet, basename="portefeuille")

urlpatterns = [
    path("auth/inscription/", InscriptionView.as_view(), name="inscription"),
    path("auth/connexion/", ConnexionView.as_view(), name="connexion"),
    path("auth/rafraichir/", RafraichirView.as_view(), name="rafraichir"),
    path("auth/deconnexion/", DeconnexionView.as_view(), name="deconnexion"),
    path("auth/profile/", CurrentLogUserView.as_view(), name="profile"),
    path("auth/mot-de-passe/", ChangerMotDePasseView.as_view(), name="mot-de-passe"),
    path("portefeuilles/<int:pk>/actifs/", AjoutActifView.as_view(), name="portefeuille-actifs"),
    path(
        "portefeuilles/<int:pk>/actifs/<str:symbole>/",
        ActifDuPortefeuilleView.as_view(),
        name="portefeuille-actif",
    ),
] + router.urls
