"""Source contract regressions for approved v4; not browser or deployment proof."""
import json
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
class V4Contract(unittest.TestCase):
    def test_ui_primitives_and_source_notices_are_present(self):
        pkg=json.loads((ROOT/'platform/package.json').read_text())
        lock=json.loads((ROOT/'platform/package-lock.json').read_text())
        for name in ['@radix-ui/react-avatar','@radix-ui/react-dropdown-menu','@radix-ui/react-slot','tailwindcss','class-variance-authority']:
            self.assertEqual(pkg['dependencies'][name],lock['packages']['']['dependencies'][name])
        for name in ['button','avatar','dropdown-menu']:
            self.assertTrue((ROOT/f'platform/apps/web/src/components/ui/{name}.tsx').is_file())
        self.assertIn('Copyright (c) 2023 shadcn',(ROOT/'platform/legal/shadcn-MIT.txt').read_text())
        self.assertIn('npm run test:browser:v4',(ROOT/'.github/workflows/ci.yml').read_text())
    def test_portrait_fixtures_are_demo_gated_with_a_neutral_fallback(self):
        src=(ROOT/'platform/apps/web/src/components/ui.tsx').read_text()
        self.assertIn("member?.avatar || (mode==='demo'&&member?demoPortraits[member.userId]:undefined)",src)
        self.assertIn('<AvatarFallback><UserRound',src)
        self.assertNotIn("member.colour",src)
    def test_former_members_never_show_a_portrait(self):
        src=(ROOT/'platform/apps/web/src/components/ui.tsx').read_text()
        self.assertIn("const photo=member?.status==='left'?undefined:",src)
    def test_shell_keeps_routes_and_does_not_embed_the_static_mock(self):
        src=(ROOT/'platform/apps/web/src/App.tsx').read_text()
        for path in ['/paths/:id','/projects/:id/work','/learn/:id/studio','/messages/:id','/outputs','/access','/operations','/settings','/profile']:
            self.assertIn(f'path="{path}"',src)
        self.assertEqual(src.count('aria-label="Account menu"'),1)
        for removed in ['className="sidebar-search"','className="community-name"','className="account-block"','<iframe']:
            self.assertNotIn(removed,src)
        self.assertIn('<DropdownMenu modal={false}>',src)
if __name__=='__main__':unittest.main()
