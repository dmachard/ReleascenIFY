# Release Parser

A robust, regex-based Python library to parse scene release names and extract technical metadata (title, year, resolution, quality, codec, audio, languages, etc.).

## Why?
Release names follow a strict grammar inherited from the Scene and P2P groups. Once decoded, you can predict the quality, source, language, and release group just from the filename. This library is a modernized alternative to PTN (Parse Torrent Name).

## Installation
*(To be published on PyPI)*

## Usage

```python
from releasify import parse_filename
from releasify.comparator import get_quality_score, is_better_release

filename = "Dune.Part.Two.2024.MULTi.2160p.WEB-DL.DV.HDR.H265-GROUP"
parsed = parse_filename(filename)

print(parsed)
# {
#   "title": "Dune Part Two",
#   "year": 2024,
#   "resolution": "2160P",
#   "quality": "WEB-DL",
#   "v_quality": "HDR DV",
#   "codec": "H265",
#   "languages": ["MULTI"]
#   ...
# }

# Compare two releases
score = get_quality_score(parsed)
print(f"Quality Score: {score}")
```

## Development & Tests

### Setup Local Virtual Environment

To set up the development environment, create a virtual environment and install the package in editable mode with development dependencies:

```bash
# Create the virtual environment
virtualenv .venv

# Activate the virtual environment
source .venv/bin/activate

# Install the package in editable/development mode
pip install -e .[dev]
```

### Run Tests

Run the test suite using `pytest`:

```bash
pytest tests/ -v
```