# Releascenify

<p align="center">
  <img src="imgs/logo_releascenify.png" alt="Releascenify Logo" width="400">
</p>

A regex-based Python library to parse scene release names and extract technical metadata (title, year, resolution, quality, codec, audio, languages, etc.).

**Live Demo & Web Interface:** [https://dmachard.github.io/releascenify/docs/](https://dmachard.github.io/releascenify/docs/)

## Why?
Release names follow a strict grammar inherited from the Scene and P2P groups. Once decoded, you can predict the quality, source, language, and release group just from the filename. This library is a modernized alternative to PTN (Parse Torrent Name).

## Installation

```bash
pip install releascenify
```

## Usage

```python
from releascenify import parse_filename
from releascenify.comparator import get_quality_score, is_better_release

filename = "Gladiator.II.2024.MULTi.2160p.WEB-DL.DV.HDR.H265-GROUP"
parsed = parse_filename(filename)

print(parsed)
# {
#   "title": "Gladiator II",
#   "year": 2024,
#   "resolution": "2160P",
#   "quality": "WEB-DL",
#   "v_quality": "HDR DV",
#   "codec": "H265",
#   "languages": ["MULTI"]
#   ...
# }

# Calculate quality score
score = get_quality_score(parsed)
print(f"Quality Score: {score}")

# Compare two releases
rel_a = parse_filename("Gladiator.II.2024.1080p.BluRay.x264-GROUP")
rel_b = parse_filename("Gladiator.II.2024.2160p.WEB-DL.x265-GROUP")

if is_better_release(rel_b, rel_a):
    print("Release B is better than Release A")
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

### Run Website Locally

Due to browser CORS security policies, opening the HTML files directly as a local file (via `file://`) will block loading the relative Python files. You need to run a local web server from the repository root:

```bash
# Start a local HTTP server
python3 -m http.server 8000
```

Then navigate to: [http://localhost:8000/](http://localhost:8000/) (which redirects to `/docs/`) or directly to [http://localhost:8000/docs/](http://localhost:8000/docs/).