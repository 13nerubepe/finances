from django.urls import path

from .views import ExplicationPicView

urlpatterns = [
    path("agent/pics/<str:symbole>/<str:jour>/explication/", ExplicationPicView.as_view(), name="explication-pic"),
]
