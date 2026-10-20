from google import genai
from google.genai import types

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
    prompt = (
        f"""
Find recent news about the asset {asset}. Explain the last movement in its price and provide reasons for it. Be concise, don't hallucinate
        """
    )
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(tools=[search_tool])
        )

    return {
        "asset":asset,
        "price_move":None,
        "analysis":response.text,
        "sources":extract_sources(response)
    }