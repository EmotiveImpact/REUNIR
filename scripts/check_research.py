#!/usr/bin/env python3
"""Validate research provenance links without making licence or test-pass claims."""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path
from typing import Any

MODES = {'behaviour_reference', 'existing_code_reuse', 'potential_source_import', 'source_import'}
STATUSES = {'implemented', 'queued', 'hold', 'rejected'}

def validate(register: dict[str, Any], root: Path) -> list[str]:
    errors: list[str] = []
    sources = register.get('sources', [])
    ids: set[str] = set()
    for source in sources:
        sid = source.get('id', '')
        if not sid or sid in ids:
            errors.append('Source ids must be nonempty and unique.')
        ids.add(sid)
        for name in ('project', 'repository', 'file', 'licence', 'lesson', 'reviewedOn'):
            if not isinstance(source.get(name), str) or not source[name].strip():
                errors.append(f'{sid}: missing {name}.')
        revision, blob = source.get('revision'), source.get('blob')
        if not any(isinstance(v, str) and re.fullmatch(r'[a-f0-9]{40}', v) for v in (revision, blob)):
            errors.append(f'{sid}: a commit or blob must pin reviewed evidence.')
        if not str(source.get('url', '')).startswith('https://github.com/' + source.get('repository', '') + '/blob/'):
            errors.append(f'{sid}: source URL does not match its repository.')
    decisions: set[str] = set()
    for item in register.get('decisions', []):
        iid = item.get('id', '')
        if not iid or iid in decisions:
            errors.append('Decision ids must be nonempty and unique.')
        decisions.add(iid)
        if item.get('status') not in STATUSES or item.get('mode') not in MODES:
            errors.append(f'{iid}: unsupported status or reuse mode.')
        if not item.get('sources') or any(s not in ids for s in item['sources']):
            errors.append(f'{iid}: unknown or missing upstream source.')
        if item.get('status') == 'implemented' and (not item.get('implementation') or not item.get('tests')):
            errors.append(f'{iid}: implemented decisions need implementation and test paths.')
        for relative in item.get('implementation', []) + item.get('tests', []):
            path = (root / relative).resolve()
            if not path.is_relative_to(root.resolve()) or not path.is_file() or 'node_modules' in path.parts:
                errors.append(f'{iid}: invalid local evidence path: {relative}')
        if item.get('mode') == 'source_import' and item.get('status') == 'implemented':
            if item.get('licenceDecision') != 'approved' or not item.get('notices'):
                errors.append(f'{iid}: imported source needs an approved licence decision and notices.')
            for notice in item.get('notices', []):
                path = (root / notice).resolve()
                if not path.is_relative_to(root.resolve()) or not path.is_file():
                    errors.append(f'{iid}: missing notice file.')
    return errors

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    try:
        record = json.loads((args.root / 'research/reuse-register.json').read_text())
        errors = validate(record, args.root)
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print(f'Research register could not be validated: {exc}')
        return 1
    if errors:
        print('\n'.join(errors))
        return 1
    print(f"Research register: {len(record['sources'])} pinned sources, {len(record['decisions'])} decisions. Local links valid; no legal or test-pass certification implied.")
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
