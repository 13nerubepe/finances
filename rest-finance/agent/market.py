import yfinance as yf

def get_price_move(ticker: str) ->dict | None:
    history = yf.Ticker(ticker).history(period="2d")
    if len(history) <2:
        return None
    last = history.iloc[-1]
    previous = history.iloc[-2]
    change_pct = (last['Close'] - previous['Close']) / previous['Close'] * 100 #Pourcentage de variation
    return {
        'date':history.index[-1].strftime('%Y-%m-%d'),
        'close':round(float(last['Close']), 2),
        'previous_close':round(float(previous['Close']),2),
        'change_pct':round(float(change_pct), 2)
    }