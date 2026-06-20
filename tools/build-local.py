#!/usr/bin/env python3

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "brake-tool-offline.html"

MODULES = [
    "units",
    "components",
    "solver",
    "plots",
    "dom",
    "config",
    "optimize",
    "share",
    "state",
    "fields",
    "panel",
    "charts",
    "results",
    "ui",
]

IMPORT_RE = re.compile(
    r"^[ \t]*import\s*\{(?P<names>[^}]*)\}\s*from\s*['\"](?P<path>[^'\"]+)['\"]\s*;?[ \t]*\n",
    re.MULTILINE | re.DOTALL,
)
BARE_IMPORT_RE = re.compile(
    r"^[ \t]*import\s+['\"][^'\"]+['\"]\s*;?[ \t]*\n", re.MULTILINE
)
EXPORT_DECL_RE = re.compile(
    r"^[ \t]*export\s+(?P<rest>(?:async\s+)?(?:const|let|var|function|class)\s+)",
    re.MULTILINE,
)
EXPORT_NAME_RE = re.compile(
    r"^[ \t]*export\s+(?:async\s+)?(?:const|let|var|function|class)\s+"
    r"(?P<name>[A-Za-z_$][\w$]*)",
    re.MULTILINE,
)
EXPORT_LIST_RE = re.compile(r"^[ \t]*export\s*\{(?P<names>[^}]*)\}\s*;?[ \t]*\n", re.MULTILINE)

def module_key(path: str) -> str:
    """'./config.js' -> 'config'"""
    return Path(path).stem

def parse_specifiers(raw: str):
    """'a, b as c' -> [('a','a'), ('b','c')]"""
    out = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        if " as " in part:
            src, dst = (p.strip() for p in part.split(" as ", 1))
        else:
            src = dst = part
        out.append((src, dst))
    return out

def transform(name: str, src: str):
    """Returns (js_for_registry, exported_names, imported_module_keys)."""
    exported = [m.group("name") for m in EXPORT_NAME_RE.finditer(src)]

    for m in EXPORT_LIST_RE.finditer(src):
        exported.extend(dst for _, dst in parse_specifiers(m.group("names")))

    if "export default" in src:
        sys.exit(f"{name}.js: `export default` is not supported by this bundler.")

    imported_keys = []
    prelude = []

    def replace_import(m):
        key = module_key(m.group("path"))
        imported_keys.append(key)
        specs = parse_specifiers(m.group("names"))
        fields = ", ".join(s if s == d else f"{s}: {d}" for s, d in specs)
        prelude.append(f"  const {{ {fields} }} = __M['{key}'];")
        return ""

    body = IMPORT_RE.sub(replace_import, src)
    body = BARE_IMPORT_RE.sub("", body)
    body = EXPORT_DECL_RE.sub(lambda m: m.group("rest"), body)
    body = EXPORT_LIST_RE.sub("", body)

    if re.search(r"^\s*(import|export)\s", body, re.MULTILINE):
        leftover = re.findall(r"^\s*(?:import|export).*$", body, re.MULTILINE)
        sys.exit(f"{name}.js: unhandled module syntax:\n  " + "\n  ".join(leftover[:5]))

    indented = "\n".join(("  " + line if line.strip() else line) for line in body.split("\n"))
    returns = ", ".join(sorted(set(exported)))

    chunk = (
        f"/* ==== {name}.js "
        + "=" * max(0, 66 - len(name))
        + f" */\n__M['{name}'] = (function () {{\n"
        + ("\n".join(prelude) + "\n" if prelude else "")
        + indented
        + f"\n  return {{ {returns} }};\n}})();\n"
    )
    return chunk, sorted(set(exported)), imported_keys

def main():
    css = (ROOT / "css" / "app.css").read_text(encoding="utf-8")
    html = (ROOT / "index.html").read_text(encoding="utf-8")

    chunks = []
    available = set()
    for name in MODULES:
        path = ROOT / "js" / f"{name}.js"
        if not path.exists():
            sys.exit(f"missing module: {path}")
        chunk, exports, imports = transform(name, path.read_text(encoding="utf-8"))
        for dep in imports:
            if dep not in available:
                sys.exit(
                    f"{name}.js imports '{dep}' which is not built yet. "
                    f"Fix the order in MODULES."
                )
        available.add(name)
        chunks.append(chunk)
        print(f"  {name+'.js':<16} {len(exports):>2} exports, {len(set(imports)):>2} imports")

    bundle = (
        "<script>\n"
        + "(function () {\n'use strict';\nconst __M = {};\n\n"
        + "\n".join(chunks)
        + "\n})();\n</script>"
    )

    html, n = re.subn(
        r'[ \t]*<link rel="stylesheet" href="css/app\.css">[ \t]*\n',
        lambda _m: f"<style>\n{css}\n</style>\n",
        html,
    )
    if n != 1:
        sys.exit("could not find the stylesheet link in index.html")

    html, n = re.subn(
        r'[ \t]*<script type="module" src="js/ui\.js"></script>[ \t]*\n',
        lambda _m: bundle + "\n",
        html,
    )
    if n != 1:
        sys.exit("could not find the module script tag in index.html")

    strapline = "<p>Berkeley Formula Racing &middot; port of <code>brakescript_w_aero_B27.m</code></p>"
    if strapline not in html:
        sys.exit("could not find the strapline in index.html")
    html = html.replace(strapline, strapline.replace("</p>", " &middot; offline build</p>"))

    verify(html, bundle)

    OUT.write_text(html, encoding="utf-8")
    kb = OUT.stat().st_size / 1024
    print(f"\nwrote {OUT.relative_to(ROOT)}  ({kb:.0f} kB, self-contained)")
    print("open it by double-clicking; no server needed")

def verify(html: str, bundle: str):
    """
    Self-checks on the generated output.

    The first one is not paranoia: an earlier version of this script passed the
    bundle to re.sub as a replacement STRING, so Python processed the backslash
    escapes inside the JavaScript and silently broke every regex literal. The
    page loaded and rendered nothing. Counting backslashes catches that class of
    corruption immediately.
    """
    print()

    src_backslashes = sum(
        (ROOT / "js" / f"{m}.js").read_text(encoding="utf-8").count("\\") for m in MODULES
    )
    out_backslashes = bundle.count("\\")
    if out_backslashes < src_backslashes:
        sys.exit(
            f"  FAIL  {src_backslashes - out_backslashes} backslash escape(s) lost in bundling.\n"
            f"        Check that every re.sub replacement is a function, not a string."
        )
    print(f"  ok    {out_backslashes} backslash escapes preserved")

    fetching = re.findall(
        r'<(?:script|img|iframe|audio|video|source)\b[^>]*\bsrc="(?!data:)([^"]*)"'
        r'|<link\b(?![^>]*\brel="canonical")[^>]*\bhref="(?!data:)([^"]*)"',
        html,
    )
    remaining = [u for pair in fetching for u in pair if u]
    if remaining:
        sys.exit(f"  FAIL  the page still fetches: {remaining}")
    print("  ok    nothing is fetched at load time")

    if 'type="module"' in html:
        sys.exit("  FAIL  a module script survived")
    if re.search(r"^\s*(?:import|export)\s", bundle, re.MULTILINE):
        sys.exit("  FAIL  import/export syntax survived in the bundle")
    print("  ok    no module syntax remains")

    jsc = Path(
        "/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc"
    )
    if jsc.exists():
        import subprocess
        import tempfile

        with tempfile.TemporaryDirectory() as td:
            js_path = Path(td) / "bundle.js"
            js_path.write_text(bundle[len("<script>\n") : -len("\n</script>")], encoding="utf-8")
            check = Path(td) / "check.js"
            check.write_text(
                f"try {{ new Function(readFile({str(js_path)!r})); print('OK'); }}\n"
                f"catch (e) {{ print('ERR ' + e); }}\n",
                encoding="utf-8",
            )
            res = subprocess.run([str(jsc), str(check)], capture_output=True, text=True)
            out = res.stdout.strip()
            if not out.startswith("OK"):
                sys.exit(f"  FAIL  bundle does not parse: {out}")
        print("  ok    bundle parses cleanly (JavaScriptCore)")
    else:
        print("  --    skipped parse check (no JavaScriptCore on this platform)")

if __name__ == "__main__":
    main()
