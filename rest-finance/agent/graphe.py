"""L'agent conversationnel : Gemini choisit et appelle nos outils pour répondre."""

from datetime import date

from langchain.agents import create_agent
from langchain_google_genai import ChatGoogleGenerativeAI

from .models import Explication
from .outils import OUTILS
from .services import MODELE

CONSIGNES = """Tu es l'assistant d'analyse de volatilité de l'application MEFA. Nous sommes le {aujourdhui}.

Règles :
- Réponds en français, de façon claire et concise.
- N'utilise que les chiffres renvoyés par tes outils, n'en invente jamais.
- Pour trouver les pics d'un actif, appelle lister_pics ; pour expliquer un pic, expliquer_un_pic ;
  pour le détail d'une journée, indicateurs_du_jour.
- Quand tu expliques un mouvement, cite les sources (titre et lien).
- Si l'utilisateur parle de « mon portefeuille » ou de « mes actifs », utilise la liste ci-dessous
  et traite en priorité les 2 ou 3 actifs les plus concernés.
- Si une information n'est pas disponible, dis-le simplement.
- Tu n'es pas un conseiller financier : ne recommande jamais d'acheter ou de vendre.

Portefeuilles de l'utilisateur :
{portefeuilles}"""


def decrire_portefeuilles(utilisateur):
    """Résumé texte des portefeuilles de l'utilisateur, ajouté aux consignes de l'agent."""
    lignes = []
    for portefeuille in utilisateur.portefeuilles.prefetch_related("positions__actif"):
        actifs = []
        for position in portefeuille.positions.all():
            texte = position.actif.symbole
            if position.quantite is not None:
                texte += f" (quantité {position.quantite.normalize():f})"
            actifs.append(texte)
        lignes.append(f"- {portefeuille.nom} : {', '.join(actifs) or 'vide'}")
    return "\n".join(lignes) or "aucun portefeuille"


def sources_utilisees(messages):
    """Sources des explications que l'agent a demandées pendant sa réponse."""
    sources = []
    for message in messages:
        for appel in getattr(message, "tool_calls", []):
            if appel["name"] != "expliquer_un_pic":
                continue
            try:
                jour = date.fromisoformat(appel["args"].get("jour", ""))
            except ValueError:
                continue
            explication = Explication.objects.filter(
                pic__actif__symbole__iexact=appel["args"].get("symbole", ""), pic__date=jour
            ).first()
            if explication:
                for source in explication.sources:
                    if source["url"] not in [s["url"] for s in sources]:
                        sources.append({**source, "type": "actualite"})
    return sources


def repondre(question, historique=(), portefeuilles="aucun portefeuille"):
    """Pose une question à l'agent.
    historique : échanges précédents, sous la forme [("user", texte), ("assistant", texte), ...].
    Renvoie {"reponse": texte, "sources": [...]}."""
    consignes = CONSIGNES.format(aujourdhui=date.today().strftime("%d/%m/%Y"), portefeuilles=portefeuilles)
    agent = create_agent(
        ChatGoogleGenerativeAI(model=MODELE, temperature=0.2),
        OUTILS,
        system_prompt=consignes,
    )
    messages = list(historique) + [("user", question)]
    resultat = agent.invoke({"messages": messages}, config={"recursion_limit": 5}) #Recursion limit a 5 car on consomme tres vite les quota de Gemini
    return {
        "reponse": resultat["messages"][-1].text,
        "sources": sources_utilisees(resultat["messages"]),
    }
