# REUNIR Open-Source Licensing Register

**Important:** This is an engineering/research risk register, not legal advice. Before incorporating third-party source into a commercial product, have counsel or a qualified open-source licensing specialist review the exact version/files involved.

| Project | Licence evidence found | Working REUNIR posture |
| --- | --- | --- |
| Roost | README says `MIT`; current root repo metadata did not expose a root LICENSE file | **Do not copy yet.** Ask maintainer/verify definitive licence file and copyright scope |
| OpenCircle | README badge + `LICENSE.md`: AGPL-3.0 | Study patterns; avoid copying into proprietary core without deliberate AGPL compliance/licence |
| ClassroomIO | Root `LICENSE`: AGPL-3.0; GitHub metadata AGPL. Root `package.json` says MIT, creating a conflict | **Treat as AGPL** until copyright holder clarifies in writing |
| LearnHouse | README + root LICENSE: AGPL-3.0; enterprise licence for some features | Study patterns; commercial licence discussion if code reuse becomes attractive |
| Frappe Learning | `license.txt`: AGPL-3.0 | Study workflows; do not embed covered implementation into proprietary core without compliance |
| HumHub | Root LICENSE declares dual AGPL/proprietary model | Study architecture; proprietary integration requires appropriate commercial licence or AGPL compliance |

## Why AGPL matters to REUNIR

AGPL is designed to extend source-sharing obligations to modified covered software offered to users over a network.

The practical REUNIR consequence is not “AGPL cannot be commercial”. AGPL software **can** be commercial. The issue is whether our intended product/licensing model is compatible with its source-disclosure and copyleft obligations.

Because we want to preserve the option of:

- proprietary hosted SaaS
- commercial enterprise licensing
- self-hosted community/open-core edition
- premium closed modules

we should avoid accidentally making the product legally dependent on an AGPL codebase before choosing that model deliberately.

## Clean-room research rule

Third-party repos live under:

```text
REUNIR/research/
```

Our implementation lives under:

```text
REUNIR/platform/
```

Rules:

1. Ideas, public behaviour, workflows and architectural concepts may be documented in research notes.
2. Do not copy/paste third-party source into `platform/` merely because it is convenient.
3. Before using any implementation, record:
   - repository
   - commit/version
   - exact file/dependency
   - licence
   - notice requirements
   - copyleft/linking/network implications
4. Keep third-party notices for permissive components where required.
5. Audit generated/copied UI assets separately from source-code licences.
6. Do not assume npm/package metadata overrides the repository's explicit root licence when they conflict.

## ClassroomIO specific warning

As of this audit:

- `package.json` says `MIT`
- root `LICENSE` is GNU AGPL v3
- GitHub repository metadata reports AGPL-3.0

For conservative engineering governance, **AGPL wins our risk classification** until the maintainer resolves the discrepancy.

## Roost specific warning

Roost's README states MIT, but the root repository did not expose a conventional root licence file through the audit. Before reusing source, verify the copyright holder's intended licence and whether all included assets/components are covered.
