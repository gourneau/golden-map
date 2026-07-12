# The Golden Map

An interactive 3D reconstruction of the pulsar map engraved on the Voyager Golden
Record — the real fourteen pulsars, with real coordinates, and an honest answer to
the question: *if someone reconstructed this map, would it actually point home?*

## Run it

A plain static site — no build step, no dependencies. Serve the folder from
anywhere (GitHub Pages hosts it as-is):

```sh
python3 -m http.server 8123   # then open http://localhost:8123
```

Source lives in `js/` and `css/`; third-party code and public-domain assets
(Three.js, fonts, NASA artwork/model/texture, star catalog) in `vendor/`.

## What it shows

Five acts:

1. **The Record** — the artifact itself, with the map engraved on its face.
2. **The Map** — how to read it: the hydrogen 21 cm hyperfine period
   (0.704024 ns) as the unit, tick-dash binary periods, line length as distance.
3. **The Pulsars** — the master list of all 14, clickable, each blinking at a
   scaled version of its true period.
4. **Is It Wrong?** — the engraved 1969 geometry (gold) against modern parallax
   reality (starlight). Distances were off 2–10×; three bearings off 10–18°;
   yet every documented reconstruction still found the Sun.
5. **For the Finders** — a 100-million-year time slider: watch the beacons die
   and galactic shear tear the map apart, and see what an alien decoder would
   have to fix.

## Science

Data and claims are sourced in `research/brief-raw.txt` (a synthesized, adversarially
cross-checked research brief). Primary sources: Wm. Robert Johnston's line-by-line
reanalysis of the map; Sagan, Sagan & Drake, *Science* 175 (1972); the ATNF Pulsar
Catalogue; R. Russel's DSES reconstruction; NASA/JPL Voyager documentation.

Coordinate conventions, the binary encoding, and the epoch math live in
`js/astro.js`; the dataset in `js/data/pulsars.js`. Module architecture is
documented in `CONTRACTS.md`.

Background stars are the real sky: every star brighter than magnitude 4.5, at
its true position, from the [HYG database](https://github.com/astronexus/HYG-Database)
v3 (David Nash, astronexus.com, CC BY-SA 4.0). The spacecraft is NASA's
[Voyager 3D model](https://science.nasa.gov/resource/voyager-3d-model/) (public
domain, mesh-optimized); the Earth texture is NASA's cloud-free
[Blue Marble](https://visibleearth.nasa.gov/images/57752) (public domain).
