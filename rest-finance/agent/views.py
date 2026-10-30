from django.shortcuts import render
from django.http import JsonResponse
from .services import analyze_asset
from google.genai import errors

# Create your views here.
def analyse(request):
    asset = request.GET.get("asset")
    if not asset:
        return JsonResponse({"error":"Parametre 'asset' manquant"},status=400)

    try:
        result = analyze_asset(asset)
    except errors.APIErrors as e:
        return JsonResponse({"error": "Erreur IA", "details":str(e)}, status=503)
    except Exception as e:
        return JsonResponse({"error":"Erreur interne", "details": str(e)},status=500)

    if "error" in result:
        return JsonResponse({"error":"Erreur d'analyse", "details":result},status=404)
    return JsonResponse(analyze_asset(asset))
