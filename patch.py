import re

with open('src/analysis.py', encoding='utf-8') as f:
    content = f.read()

# Fix BASE_DIR to point to project root
content = content.replace(
    'BASE_DIR      = os.path.dirname(os.path.abspath(__file__))',
    'SRC_DIR       = os.path.dirname(os.path.abspath(__file__))\nBASE_DIR      = os.path.dirname(SRC_DIR)  # project root'
)

with open('src/analysis.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('SRC_DIR' in content and 'patched OK' or 'FAILED')
