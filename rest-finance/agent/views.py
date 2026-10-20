from django.shortcuts import render
from django.http import JsonResponse
from .services import analyze_asset

# Create your views here.
def analyse(request):
    asset = request.GET.get("asset")
    if not asset:
        return JsonResponse({"error":"Parametre 'asset' manquant"},status=400)
    return JsonResponse(analyze_asset(asset))