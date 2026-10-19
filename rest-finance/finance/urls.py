from rest_framework.routers import DefaultRouter
from .views import ActifViewSet

router = DefaultRouter()
router.register('actifs', ActifViewSet, basename='actif')
urlpatterns = router.urls