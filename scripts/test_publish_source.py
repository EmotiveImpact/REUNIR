import unittest, tempfile, json, hashlib, subprocess
from pathlib import Path
from publish_source import records, collisions, stage_copy, check_staged_code
class PublicationSafety(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)/"source";self.dest=Path(self.tmp.name)/"destination";self.root.mkdir();self.dest.mkdir()
        (self.root/"README.md").write_text("# REUNIR Alpha 04")
        self.rows=[{"path":"README.md","sha256":hashlib.sha256((self.root/"README.md").read_bytes()).hexdigest()}]
        self.manifest()
    def tearDown(self):self.tmp.cleanup()
    def manifest(self): (self.root/"SOURCE_MANIFEST.json").write_text(json.dumps({"files":self.rows}))
    def test_verifies_hash(self):self.assertEqual(records(self.root),self.rows)
    def test_changed_source_fails(self):
        (self.root/"README.md").write_text("Changed")
        with self.assertRaises(ValueError):records(self.root)
    def test_path_traversal_fails(self):
        self.rows[0]["path"]="../escape";self.manifest()
        with self.assertRaises(ValueError):records(self.root)
    def test_env_files_forbidden(self):
        self.rows[0]["path"]="platform/.env.production";self.manifest()
        with self.assertRaises(ValueError):records(self.root)
    def test_env_templates_allowed(self):
        for name in (".env.example",".env.staging.example"):
            (self.root/"platform").mkdir(exist_ok=True);(self.root/"platform"/name).write_text("NODE_ENV=production\n")
            self.rows=[{"path":"platform/"+name,"sha256":hashlib.sha256((self.root/"platform"/name).read_bytes()).hexdigest()}];self.manifest()
            self.assertEqual(records(self.root),self.rows)
    def test_node_modules_forbidden(self):
        self.rows[0]["path"]="platform/node_modules/x";self.manifest()
        with self.assertRaises(ValueError):records(self.root)
    def test_duplicate_paths_fail(self):
        self.rows.append(self.rows[0]);self.manifest()
        with self.assertRaises(ValueError):records(self.root)
    def test_differing_existing_work_is_not_overwritten(self):
        (self.dest/"README.md").write_text("Existing team decisions")
        with self.assertRaises(ValueError):stage_copy(self.root,self.dest,self.rows)
        self.assertEqual((self.dest/"README.md").read_text(),"Existing team decisions")
    def test_original_readme_placeholder_may_be_replaced(self):
        (self.dest/"README.md").write_text("# REUNIR\n");stage_copy(self.root,self.dest,self.rows)
        self.assertEqual((self.dest/"README.md").read_text(),"# REUNIR Alpha 04")
    def test_unrelated_work_is_preserved(self):
        (self.dest/"team.txt").write_text("keep");stage_copy(self.root,self.dest,self.rows)
        self.assertEqual((self.dest/"team.txt").read_text(),"keep")
    def test_symlink_escape_is_rejected(self):
        (self.dest/"README.md").symlink_to(self.root/"README.md")
        self.assertEqual(collisions(self.root,self.dest,self.rows),["README.md"])
    def test_existing_manifest_is_not_overwritten(self):
        (self.dest/"SOURCE_MANIFEST.json").write_text('{"team":"existing decisions"}')
        with self.assertRaises(ValueError):stage_copy(self.root,self.dest,self.rows)
        self.assertEqual((self.dest/"SOURCE_MANIFEST.json").read_text(),'{"team":"existing decisions"}')
    def initialise_git(self):
        subprocess.run(["git","init","-q",str(self.dest)],check=True)
        subprocess.run(["git","-C",str(self.dest),"config","core.autocrlf","false"],check=True)
    def test_licence_whitespace_is_preserved(self):
        self.initialise_git()
        licence=self.dest/"platform/legal/dependencies/example-LICENSE.txt"
        licence.parent.mkdir(parents=True)
        original=b"Copyright notice  \r\nKeep this exact copy.\r\n"
        licence.write_bytes(original)
        code=self.dest/"platform/apps/api/example.ts";code.parent.mkdir(parents=True)
        code.write_text("export const example = true;\n")
        subprocess.run(["git","-C",str(self.dest),"add","--all"],check=True)
        check_staged_code(self.dest)
        self.assertEqual(licence.read_bytes(),original)
    def test_owned_code_whitespace_is_checked(self):
        self.initialise_git()
        code=self.dest/"platform/apps/api/example.ts";code.parent.mkdir(parents=True)
        code.write_text("export const example = true;   \n")
        subprocess.run(["git","-C",str(self.dest),"add","--all"],check=True)
        with self.assertRaises(subprocess.CalledProcessError):check_staged_code(self.dest)
if __name__=="__main__":unittest.main()
