from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .views import ActifViewSet, CorrelationsView, CoursListView, PicsJournaliersView

router = SimpleRouter()
router.register("actifs", ActifViewSet, basename="actif")

urlpatterns = [
# RECUPERER LES COURS HISTORIQUES
    path("cours/", CoursListView.as_view(), name="cours"),
    path("correlations/", CorrelationsView.as_view(), name="correlations"),
    path("pics-journaliers/", PicsJournaliersView.as_view(), name="pics-journaliers"),

    path("", include(router.urls)),
]