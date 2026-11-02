from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import ConnexionView, DeconnexionView, InscriptionView, CurrentLogUserView

urlpatterns = [
    path("inscription/", InscriptionView.as_view(), name="inscription"),
    path("connexion/", ConnexionView.as_view(), name="connexion"),
    path("rafraichir/", TokenRefreshView.as_view(), name="rafraichir"),
    path("deconnexion/", DeconnexionView.as_view(), name="deconnexion"),
    path("profile/", CurrentLogUserView.as_view(), name="profile"),
]