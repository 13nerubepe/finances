
from rest_framework.routers import DefaultRouter

from .views import ArticleViewSet, SourceViewSet

router = DefaultRouter()
router.register("actualites", ArticleViewSet, basename="actualite")
router.register("sources", SourceViewSet, basename="source")

urlpatterns = router.urls
