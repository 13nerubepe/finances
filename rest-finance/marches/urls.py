from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .views import ActifViewSet, CorrelationsView, CoursListView

router = SimpleRouter()
router.register("actifs", ActifViewSet, basename="actif")

urlpatterns = [
    path("cours/", CoursListView.as_view(), name="cours"),
    path("correlations/", CorrelationsView.as_view(), name="correlations"),
    path("", include(router.urls)),
]