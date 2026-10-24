
def attribuer_themes(article):
    """Attribue des thèmes simples selon le titre et le contenu."""

    texte = f"{article.titre} {article.contenu}".lower()

    mots_cles = {
        "Actions et bourse": [
            "stock", "shares", "equity", "nasdaq",
            "s&p 500", "dow jones", "bourse", "action",
        ],
        "Technologie": [
            "technology", "tech", "artificial intelligence",
            "ai ", "semiconductor", "software",
        ],
        "Cryptomonnaies": [
            "bitcoin", "crypto", "ethereum", "blockchain",
        ],
        "Économie": [
            "inflation", "gdp", "economy", "recession",
            "interest rate", "économie",
        ],
        "Entreprises": [
            "earnings", "revenue", "profit", "quarterly results",
        ],
    }

    themes = [
        theme
        for theme, mots in mots_cles.items()
        if any(mot in texte for mot in mots)
    ]

    if not themes:
        themes = ["Marchés financiers"]

    article.themes = themes
    article.save(update_fields=["themes"])

    return themes
