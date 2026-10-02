"""Presentation contract checks; no cloud access or third-party test dependencies."""
import hashlib
import json
from pathlib import Path
import re
import unittest
ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = {'platform/packages/db/migrations/0001_foundation.sql': 'a7e48a65603c391acc0d04df4c793a9aa977f4a34a6b3b74e93c8972524f991b', 'platform/packages/db/migrations/0002_purpose_progress.sql': 'c1f0a1fd0c0dae04392471222d4fe173602dcf48be8d68b8cc0ab4340cec7ca7', 'platform/packages/db/migrations/0003_pilot_access.sql': '9cf2f39a3ef5c44de2eb39c387be0e77cef823ec7f1855e307a6e546ddf75005', 'platform/packages/db/migrations/0004_private_messaging.sql': 'b6baa6372bf90b93468dd21e1c368e80ecd192bc0cd208b6a69f807c26128d21', 'platform/packages/db/migrations/0005_pilot_operations.sql': '5caf67870218debcc18f763016228e59762465699605fdb716e0c26610c588ca', 'platform/packages/db/migrations/0006_project_work.sql': 'c7f176ed7bd2d796a28b603c717b9b848ba64ea4b2d1c179c9e79d58a098f445', 'platform/packages/db/migrations/0007_creator_authoring.sql': '0f5a4a775301ccc89f314df22347d84b57c86b6c7bf0f2c166cad68174e1633c'}

class MonochromeContract(unittest.TestCase):
    def test_all_literal_css_colours_are_neutral(self):
        css = (ROOT / "platform/apps/web/src/styles.css").read_text()
        colours = re.findall(r"#([0-9a-fA-F]{3,8})\b", css)
        self.assertGreater(len(colours), 100)
        for value in colours:
            if len(value) in (3, 4): value = ''.join(c * 2 for c in value)
            if len(value) not in (6, 8): continue
            self.assertEqual(value[:2], value[2:4], value)
            self.assertEqual(value[:2], value[4:6], value)

    def test_legacy_rgb_tokens_are_neutral(self):
        css = (ROOT / "platform/apps/web/src/styles.css").read_text()
        for val in re.findall(r"--accent-rgb:([^;}]+)", css):
            self.assertEqual(len(set(val.strip().split(','))), 1, val)

    def test_no_decorative_gradient(self):
        css = (ROOT / "platform/apps/web/src/styles.css").read_text()
        self.assertNotRegex(css, r"(?:linear|radial)-gradient\(")
        self.assertEqual(css.count('conic-gradient('), 1)
        self.assertIn('.progress-ring', css)

    def test_no_blanket_recolouring_of_evidence(self):
        css = (ROOT / "platform/apps/web/src/styles.css").read_text()
        self.assertNotIn('grayscale(', css)

    def test_settings_preserve_legacy_accent(self):
        src = (ROOT / "platform/apps/web/src/pages/people.tsx").read_text()
        self.assertIn('accent: savedAccent(data.organisation.accent)', src)
        self.assertNotIn("f.get('accent')", src)
        self.assertIn('Original images and evidence are not recoloured.', src)

    def test_authoritative_docs_link_the_design_contract(self):
        for name in ('AGENTS.md','SESSION_HANDOFF.md','platform/docs/PRD.md','platform/docs/ROADMAP.md'):
            self.assertIn('UI_DESIGN_DIRECTION.md', (ROOT / name).read_text(), name)
        prd = (ROOT / 'platform/docs/PRD.md').read_text()
        self.assertNotIn('restrained violet primary accent', prd)

    def test_migrations_are_byte_identical_to_alpha06(self):
        for name, expected in MIGRATIONS.items():
            self.assertEqual(hashlib.sha256((ROOT / name).read_bytes()).hexdigest(), expected, name)

    def test_browser_check_is_in_ci(self):
        pkg = json.loads((ROOT / 'platform/package.json').read_text())
        self.assertIn('test:browser:monochrome', pkg['scripts'])
        self.assertIn('npm run test:browser:monochrome', (ROOT / '.github/workflows/ci.yml').read_text())

if __name__ == '__main__': unittest.main()
