from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .views import ActifDuPortefeuilleView, AjoutActifView, PortefeuilleViewSet

router = SimpleRouter()
router.register("portefeuilles", PortefeuilleViewSet, basename="portefeuille")

urlpatterns = [
    path("portefeuilles/<int:pk>/actifs/", AjoutActifView.as_view(), name="portefeuille-actifs"),
    path(
        "portefeuilles/<int:pk>/actifs/<str:symbole>/",
        ActifDuPortefeuilleView.as_view(),
        name="portefeuille-actif",
    ),
    path("", include(router.urls)),
]