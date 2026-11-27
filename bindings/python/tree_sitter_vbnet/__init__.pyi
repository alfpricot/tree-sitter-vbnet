from typing import Final
from typing_extensions import CapsuleType

HIGHLIGHTS_QUERY: Final[str]
"""The syntax highlighting query for this grammar."""

LOCALS_QUERY: Final[str]
"""The local variable query for this grammar."""

TAGS_QUERY: Final[str]
"""The symbol tagging query for this grammar."""

FOLDS_QUERY: Final[str]
"""The folding query for this grammar."""

def language() -> CapsuleType:
    """The tree-sitter language function for this grammar."""
