with open('frontend/src/components/ContentPlanningDashboard/components/ContentStrategyBuilder.tsx', encoding='utf-8', errors='replace') as f:
    content = f.read()
braces = content.count('{') - content.count('}')
parens = content.count('(') - content.count(')')
brackets = content.count('[') - content.count(']')
print(f"Braces: {content.count('{')} open, {content.count('}')}, net: {braces}")
print(f"Parens: {content.count('(')} open, {content.count(')')}, net: {parens}")
print(f"Brackets: {content.count('[')} open, {content.count(']')}, net: {brackets}")
lines = content.split('\n')
for i in range(len(lines)-15, len(lines)):
    print(f"{i+1}: {lines[i]}")
