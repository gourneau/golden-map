# The Golden Record: Earth's Address, Written in Dying Stars

An interactive 3D reconstruction of the pulsar map engraved on the Voyager Golden
Record — the real fourteen pulsars, with real coordinates, and an honest answer to
the question: *if someone reconstructed this map, would it actually point home?*

**Live site:** https://gourneau.github.io/golden-map/

![The Golden Record and the Voyager probe](art/og.jpg)

## Run it

A plain static site — no build step, no bundler, no framework. Serve the folder
from anywhere (GitHub Pages hosts it as-is):

```sh
python3 -m http.server 8123   # then open http://localhost:8123
```

Source lives in `js/` and `css/`; third-party code and public-domain assets
(Three.js, fonts, NASA artwork/model/texture, star catalog) in `vendor/`.
`?still=1` renders the pinned hero frame used for the social card.

## What it shows

Five acts:

1. **The Record** — the artifact itself, spinning slowly with the real cover
   design engraved as vector linework. Grab the disc to spin it; the Voyager
   probe drifts by (click it to inspect the NASA model); a small button plays
   the record's English greeting — *"Hello from the children of planet Earth."*
2. **The Map** — the pulsar-map portion of the engraving ignites, lifts off the
   disc, and unfolds 1:1 into a real 3D map of the galaxy. The side panel
   teaches the encoding: the hydrogen 21 cm hyperfine period (0.704024 ns) as
   the time unit, tick-dash binary periods, line length as distance.
3. **The Pulsars** — the master list of all 14, clickable, each blinking at a
   scaled version of its true period, with per-pulsar reference links to the
   measurements behind every number.
4. **Is It Wrong?** — the engraved 1969 geometry (warm gold) overlaid on modern
   parallax reality (cold starlight). Distances were off 2–10×; three bearings
   off 10–18°; one period was engraved with precision nobody had — yet every
   documented reconstruction still found the Sun.
5. **For the Finders** — a 100-million-year time slider: watch the beacons die
   and galactic shear tear the map apart. Plus a playable Drake equation:
   seven dials, four famous seeds (Drake 1961, Sagan, the pessimist, the
   telescope era), and N recomputed live.

A persistent mini player streams the record itself — NASA's official
*Greetings to the Universe* (55 languages) and *Sounds of Earth* playlists,
plus the 90-minute *Music from Earth* sequence navigated by a cue sheet built
from NASA's published track lengths.

## Science

Every scientific value on the page was fact-checked against primary sources
(July 2026): the ATNF Pulsar Catalogue v2.8.1, the VLBI parallax literature on
NASA ADS, Wm. Robert Johnston's line-by-line reanalysis of the map, R. Russel's
DSES reconstruction, and NASA/JPL Voyager documentation. The Act V "Sources"
panel carries the full grouped reference list, and each pulsar's card links to
its own distance measurement and live catalogue entry.

Coordinate conventions, the binary encoding, and the epoch math live in
`js/astro.js`; the dataset (with per-pulsar provenance notes) in
`js/data/pulsars.js`; the synthesized research brief in `research/brief-raw.txt`.
Module architecture is documented in `CONTRACTS.md`.

Background stars are the real sky: every star brighter than magnitude 4.5, at
its true position, from the [HYG database](https://github.com/astronexus/HYG-Database)
v3 (David Nash, astronexus.com, CC BY-SA 4.0). The spacecraft is NASA's
[Voyager 3D model](https://science.nasa.gov/resource/voyager-3d-model/) (public
domain, mesh-optimized); the Earth texture is NASA's cloud-free
[Blue Marble](https://visibleearth.nasa.gov/images/57752) (public domain); the
cover artwork is NASA/JPL (public domain, vectorization by VectorVoyager /
Wikimedia Commons).

## Credits

Prompted and art-directed by [@gourneau](https://x.com/gourneau) 🖖. Built with
[Claude Fable 5](https://www.anthropic.com/claude) (thanks, Claude) — research,
code, and fact-checking done in [Claude Code](https://claude.com/claude-code).
