"""Bundle index.html + css + js into one self-contained file.

    python3 tools/build.py            -> dist/honeycomb-corner.html (full HTML document)
    python3 tools/build.py --fragment -> dist/honeycomb-corner.fragment.html
                                         (no <html>/<head>/<body> wrapper, for hosts that add their own)
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"


def inline(html: str) -> str:
    def css(m):
        return "<style>\n" + (ROOT / m.group(1)).read_text() + "\n</style>"

    def js(m):
        src = (ROOT / m.group(1)).read_text()
        return "<script>\n" + src.replace("</script", "<\\/script") + "\n</script>"

    html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">', css, html)
    html = re.sub(r'<script src="(js/[^"]+)"></script>', js, html)
    return html


def fragment(html: str) -> str:
    head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
    body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)
    # The host supplies charset/viewport; keep title, fonts and styles.
    head = re.sub(r"<meta (charset|name=\"viewport\")[^>]*>\n?", "", head)
    return head.strip() + "\n" + body.strip() + "\n"


def main():
    DIST.mkdir(exist_ok=True)
    html = inline((ROOT / "index.html").read_text())
    if "--fragment" in sys.argv:
        out = DIST / "honeycomb-corner.fragment.html"
        out.write_text(fragment(html))
    else:
        out = DIST / "honeycomb-corner.html"
        out.write_text(html)
    print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
