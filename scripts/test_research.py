import copy
import json
import unittest
from pathlib import Path
from check_research import validate

class ResearchRegisterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root=Path(__file__).resolve().parents[1]
        cls.record=json.loads((cls.root/'research/reuse-register.json').read_text())
    def test_delivered_register_links_resolve(self):
        self.assertEqual(validate(self.record,self.root),[])
    def test_unknown_sources_rejected(self):
        r=copy.deepcopy(self.record);r['decisions'][0]['sources']=['invented'];self.assertTrue(validate(r,self.root))
    def test_missing_tests_rejected(self):
        r=copy.deepcopy(self.record);r['decisions'][0]['tests']=[];self.assertTrue(validate(r,self.root))
    def test_unpinned_source_rejected(self):
        r=copy.deepcopy(self.record);r['sources'][0]['revision']='main';r['sources'][0]['blob']=None;self.assertTrue(validate(r,self.root))
    def test_escaping_path_rejected(self):
        r=copy.deepcopy(self.record);r['decisions'][0]['tests']=['../outside.py'];self.assertTrue(validate(r,self.root))
    def test_direct_import_needs_clearance(self):
        r=copy.deepcopy(self.record);r['decisions'][0]['mode']='source_import';self.assertTrue(validate(r,self.root))
    def test_duplicate_source_rejected(self):
        r=copy.deepcopy(self.record);r['sources'].append(r['sources'][0]);self.assertTrue(validate(r,self.root))
    def test_wrong_repo_url_rejected(self):
        r=copy.deepcopy(self.record);r['sources'][0]['url']='https://github.com/unrelated/repo/blob/main/test';self.assertTrue(validate(r,self.root))

if __name__=='__main__':unittest.main()
