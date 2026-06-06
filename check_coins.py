import re
content = open(r'c:\Users\Visha\nvidia-nim\Apha TB\server.ts', encoding='utf-8').read()
start = content.find('let allCoinsTickers')
end = content.find('];', start)
block = content[start:end]
coins = re.findall(r'symbol: "(\w+)"', block)
print(f'Total coins in allCoinsTickers: {len(coins)}')
for c in coins:
    print(' -', c)
