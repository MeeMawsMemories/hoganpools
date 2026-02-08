import re

with open("index.html", "r", errors="ignore") as f:
    txt = f.read()

urls = set()

# Original media files: ends with .png/.jpg/.webp (best for downloading)
for u in re.findall(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~%.-]+?\.(?:png|jpg|jpeg|webp)(?:\?[^"\'\s>]*)?', txt, flags=re.I):
    urls.add(u)

# Same, but escaped inside JSON strings
for u in re.findall(r'https:\\/\\/static\\.wixstatic\\.com\\/media\\/[A-Za-z0-9_~%.-]+?\\.(?:png|jpg|jpeg|webp)', txt, flags=re.I):
    urls.add(u.replace('\\/','/'))

print("\n".join(sorted(urls)))
