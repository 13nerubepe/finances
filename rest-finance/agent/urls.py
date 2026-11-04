from django.urls import path

from .views import ExplicationPicView, HistoriqueAssistantView, QuestionAssistantView

urlpatterns = [
    path("agent/pics/<str:symbole>/<str:jour>/explication/", ExplicationPicView.as_view(), name="explication-pic"),
    path("assistant-ia/question/", QuestionAssistantView.as_view(), name="assistant-question"),
    path("assistant-ia/historique/", HistoriqueAssistantView.as_view(), name="assistant-historique"),
]
