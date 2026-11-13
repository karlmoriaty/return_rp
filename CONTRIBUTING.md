# Development and checks

Install README dependencies and keep the Python environment activated when running Node wrappers. Write new output paths and preserve original `.rp` inputs.

| Command | Prerequisites |
| --- | --- |
| `npm test` | Node; no Axure/Python/private fixtures. Source syntax, registry, guards, examples and source packaging. |
| `npm run test:styles` | Node; synthetic RP/RPLIB style fixtures, no Axure/Python/private files. |
| `npm run test:polish` | Python + Pillow; real expansion/layout/Axvg alpha and alignment regressions, no Axure. |
| `npm run test:language` | Python dependencies; included synthetic JSON/specifications. |
| `npm run test:scopes` | Original panel fixture set; configure `AXURE_FIXTURE_ROOT`. |
| `npm run test:runtime` | Python dependencies and Node; reference data/aggregates and native-record construction. |
| `npm run test:mcp` | MCP SDK, local RP11 libraries and blank project; actual stdio checks on generated native widgets. |
| `npm run test:mcp-generate` | MCP SDK, Python dependencies and RP9 blank project/libraries; real stdio three/twelve-page generation and failure contracts. |
| `npm run test:jobs` | Local mock job checks, no GUI. |
| `npm run test:trace` | macOS Vision, Swift, NumPy, SciPy and Pillow. |
| `npm run test:backend`, `test:visual` | Python, local Axure installation and matching blank project. |
| `npm run test:native` | Local RP11 DefaultSettings and blank project; public widget/table example. |
| `npm run test:architecture` | Local RP9 template, libraries, runtime and Python dependencies including jsonschema. |
| `npm run test:acceptance` | Python/Node comparison and counterexample-reduction checks; live preview is separate. |
| `npm run test:historical`, `test:historical-mcp` | Original research fixtures, not included. Set `AXURE_FIXTURE_ROOT` and `AXURE_SNAPSHOTS` plus local native paths. |

Missing prerequisites are missing/skipped, never passes. Historical fixture tests are optional for contributors who already have those inputs and are not represented as standalone public coverage.

```sh
export AXURE_BLANK_TEMPLATE_RP9=/absolute/path/to/own-rp9-blank.rp
export AXURE_BLANK_TEMPLATE_RP11=/absolute/path/to/own-rp11-blank.rp
```

`AXURE_APP_RP9` and `AXURE_APP_RP11` select non-default installations. `AXURE_SETTINGS_ROOT` selects RP11 DefaultSettings for the older native example. `AXURE_RUNTIME_SCRIPTS` selects the RP9 directory containing `sto.js` and `expr.js`.

Do not commit official templates/binaries/runtime, fonts, extracted materials, personal screenshots, credentials, dependencies or caches. Synthetic JSON fixtures are tracked. Original artwork is reproducible with `python3 examples/generate-assets.py`.

`node scripts/pack-release.mjs -o <new-directory>` includes Python, Swift, original images, synthetic fixtures, examples and benchmarks. It excludes symlinks, dependencies, caches and native binaries. Refresh source fingerprints after intentional changes; do not rewrite semantic snapshots to conceal failures.

## Sending a change

1. Fork the repository and create a topic branch from `main`.
2. Make the change and keep unrelated work out of the same branch.
3. Run `npm test` (Axure-dependent suites skip themselves when prerequisites are absent; a skipped check is not a pass).
4. Add a line to `CHANGELOG.md` under the current version for user-visible changes.
5. Open a pull request against `karlmoriaty/return_rp:main` and describe what changed and how it was verified.

There is no CLA or DCO requirement. By contributing you agree your changes are licensed under the project's MIT license, and any new media or fixture you add must carry a compatible license and attribution.

## Feedback

Original author / maintainer: **karlmoriaty** (https://github.com/karlmoriaty).
Report issues via [GitHub Issues](https://github.com/karlmoriaty/return_rp/issues) or email **3070687583@qq.com**.
