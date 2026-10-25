from google import genai
from google.genai import types
from .models import Analysis

from agent.market import get_price_move

client = genai.Client()

search_tool = types.Tool(google_search=types.GoogleSearch())

def extract_sources(response) -> list:
    sources = []
    metadata = response.candidates[0].grounding_metadata
    if metadata and metadata.grounding_chunks:
        for chunk in metadata.grounding_chunks:
            if chunk.web:
                sources.append({"title": chunk.web.title, "url": chunk.web.uri})
    return sources


def analyze_asset(asset:str) -> dict:

    move = get_price_move(asset)
    if move is None:
        return{"asset": asset, "error": "Ticker introuvable ou données indisponibles"}

    existing = Analysis.objects.filter(asset=asset,date=move['date']).first()
    if existing:
        return serialize(existing, cached=True)

    prompt = (
     f"""
     L'actif financier {asset} a varié de {move['change_pct']} % 
      le {move['date']} (clôture : {move['close']}, 
        veille : {move['previous_close']}). 
        Recherche les actualités de cette période et explique les raisons 
        probables de ce mouvement. Si aucune cause claire n'apparaît, dis-le. 
        Réponds en français, de façon factuelle et concise."""
   )
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(tools=[search_tool])
        )

    return {
        "asset":asset,
        "price_move":move,
        "analysis":response.text,
        "sources":extract_sources(response)
    }
def serialize(record: Analysis, cached: bool) -> dict:
    return {
        "asset": record.asset,
        "price_move": {
            "date": str(record.date),
            "close": record.close,
            "previous_close": record.previous_close,
            "change_pct": record.change_pct,
        },
        "analysis": record.analysis,
        "sources": record.sources,
        "cached": cached,
    }