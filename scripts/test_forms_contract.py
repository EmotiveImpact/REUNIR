"""Source contract for the shared shadcn form components; not browser or deployment proof."""
import json
from pathlib import Path
import re
import unittest
ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'platform/apps/web/src'
COMPONENTS = ['input', 'textarea', 'label', 'native-select', 'checkbox', 'radio-group', 'switch']
PACKAGES = ['@radix-ui/react-checkbox', '@radix-ui/react-label', '@radix-ui/react-radio-group', '@radix-ui/react-switch']

def sources():
    return [p for p in WEB.rglob('*.tsx') if 'components/ui' not in p.as_posix()]

class FormsContract(unittest.TestCase):
    def test_components_are_attributed_shadcn_source_with_pinned_primitives(self):
        pkg = json.loads((ROOT / 'platform/package.json').read_text())
        lock = json.loads((ROOT / 'platform/package-lock.json').read_text())
        notices = (ROOT / 'platform/THIRD_PARTY_NOTICES.md').read_text()
        for name in PACKAGES:
            self.assertRegex(pkg['dependencies'][name], r'^\d+\.\d+\.\d+$', name)
            self.assertEqual(pkg['dependencies'][name], lock['packages']['']['dependencies'][name], name)
            self.assertEqual(pkg['dependencies'][name], lock['packages']['node_modules/' + name]['version'], name)
            self.assertIn(f'`{name}` {pkg["dependencies"][name]}: MIT', notices)
            self.assertTrue((ROOT / 'platform/legal/dependencies' / (name[1:].replace('/', '__') + '-LICENSE.txt')).is_file(), name)
        for name in COMPONENTS:
            src = (WEB / f'components/ui/{name}.tsx').read_text()
            self.assertTrue(src.startswith('// Adapted from shadcn/ui new-york-v4'), name)
            self.assertIn('data-slot="', src, name)
            self.assertIn(f'| {name}.tsx |', notices)

    def test_forms_use_the_shared_components(self):
        for path in sources():
            src = path.read_text()
            rel = path.relative_to(WEB).as_posix()
            for tag in ('textarea', 'select', 'label'):
                self.assertNotRegex(src, rf'<{tag}[\s/>]', f'{rel}: native <{tag}>')
            # File pickers and the focal-point sliders are deliberately native.
            for tag in re.findall(r'<input\b[^>]*', src):
                self.assertRegex(tag, r'type="(file|range)"', f'{rel}: native {tag[:60]}')
            self.assertNotRegex(src, r'<button[^>]*className="button ', f'{rel}: legacy .button on a native button')
            self.assertNotRegex(src, r'<button[^>]*className=\{`button ', f'{rel}: legacy .button on a native button')

    def test_modal_keeps_its_native_dialog_with_shadcn_slots(self):
        src = (WEB / 'components/ui.tsx').read_text()
        self.assertIn('<dialog ref={ref} data-slot="dialog-content"', src)
        self.assertIn("d?.showModal(); return () => { d?.close(); prior?.focus?.(); };", src)
        self.assertIn('<Button type="button" variant="ghost" size="icon" className="icon-button" aria-label="Close dialogue"', src)

    def test_confirmations_use_the_shared_box(self):
        # Decision 055: one confirmation box, never the browser's own.
        for path in WEB.rglob('*.tsx'):
            self.assertNotRegex(path.read_text(), r'\bwindow\.confirm\(|\bconfirm\(\s*[`\'"]', path.relative_to(WEB).as_posix())
        src = (WEB / 'components/confirm.tsx').read_text()
        self.assertIn('role="alertdialog" data-slot="alert-dialog-content"', src)
        self.assertIn('cancel.current?.focus()', src)
        self.assertIn('<ConfirmProvider>', (WEB / 'main.tsx').read_text())

    def test_form_check_runs_in_ci_and_the_register(self):
        pkg = json.loads((ROOT / 'platform/package.json').read_text())
        self.assertEqual(pkg['scripts']['test:browser:forms'], 'tsx scripts/forms-browser-check.ts')
        self.assertIn('npm run test:browser:forms', (ROOT / '.github/workflows/ci.yml').read_text())
        register = json.loads((ROOT / 'research/reuse-register.json').read_text())
        decision = next(d for d in register['decisions'] if d['id'] == 'alpha30-shadcn-forms')
        self.assertEqual(sorted(decision['sources']), sorted('shadcn-' + n for n in COMPONENTS))

    def test_form_styles_stay_neutral(self):
        css = (WEB / 'forms.css').read_text()
        for value in re.findall(r'#([0-9a-fA-F]{3,8})\b', css):
            if len(value) in (3, 4): value = ''.join(c * 2 for c in value)
            self.assertTrue(value[:2] == value[2:4] == value[4:6], value)

if __name__ == '__main__': unittest.main()
