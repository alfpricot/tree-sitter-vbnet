"""Tree-sitter grammar for Visual Basic .NET"""

from importlib.resources import files

from ._binding import language

_QUERIES = {
    "HIGHLIGHTS_QUERY": "highlights.scm",
    "LOCALS_QUERY": "locals.scm",
    "TAGS_QUERY": "tags.scm",
    "FOLDS_QUERY": "folds.scm",
}


def __getattr__(name):
    if name not in _QUERIES:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    # A missing query file is a packaging error, so it raises.
    query = (files(__name__) / "queries" / _QUERIES[name]).read_text(encoding="utf-8")
    globals()[name] = query
    return query


__all__ = [
    "language",
    "HIGHLIGHTS_QUERY",
    "LOCALS_QUERY",
    "TAGS_QUERY",
    "FOLDS_QUERY",
]


def __dir__():
    return sorted(set(globals()) | set(__all__))
