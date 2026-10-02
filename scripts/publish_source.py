#!/usr/bin/env python3
"""Verify the release and import it into a fresh reviewed Git branch. No force push.
Default: verify local source only. --prepare clones/stages. --push commits/pushes.
No credentials are read from this script or embedded in command arguments.
"""
from __future__ import annotations
import argparse, hashlib, json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path, PurePosixPath
REMOTE = "https://github.com/EmotiveImpact/REUNIR.git"
ROOT = Path(__file__).resolve().parents[1]
# Licence copies and Markdown hard line breaks must remain byte-for-byte intact.
# Whitespace checking applies to our executable source, tests and workflows.
CODE_PATHS = ["platform/apps", "platform/api", "platform/packages", "platform/scripts",
              "platform/tests", "scripts", ".github/workflows"]

def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def records(root: Path) -> list[dict[str, str]]:
    manifest = json.loads((root / "SOURCE_MANIFEST.json").read_text())
    rows = manifest["files"]
    seen = set()
    for row in rows:
        name = row["path"]
        pure = PurePosixPath(name)
        if not name or name != pure.as_posix() or pure.is_absolute() or ".." in pure.parts or "\\" in name or name in seen:
            raise ValueError("Invalid or duplicate manifest path")
        if any(x in {".git", "node_modules", ".local", ".vercel"} for x in pure.parts):
            raise ValueError("Generated/private path in source manifest")
        if any(x.startswith(".env") and x != ".env.example" for x in pure.parts):
            raise ValueError("Private environment file in source manifest")
        target = root.joinpath(*pure.parts)
        if not target.resolve().is_relative_to(root.resolve()) or target.is_symlink():
            raise ValueError("Source path escapes workspace or is a symlink")
        if not target.is_file() or digest(target) != row["sha256"]:
            raise ValueError("Source checksum mismatch: " + name)
        seen.add(name)
    return rows

def collisions(root: Path, destination: Path, rows: list[dict[str, str]]) -> list[str]:
    conflicts = []
    for row in rows:
        target = destination / row["path"]
        if not target.resolve().is_relative_to(destination.resolve()) or target.is_symlink():
            conflicts.append(row["path"])
        elif target.exists() and (not target.is_file() or digest(target) != row["sha256"]):
            # The observed initial repository README is the only safe automatic replacement.
            if row["path"] == "README.md" and target.is_file() and target.read_text().strip() == "# REUNIR":
                continue
            conflicts.append(row["path"])
    manifest_target = destination / "SOURCE_MANIFEST.json"
    if manifest_target.is_symlink() or (manifest_target.exists() and
            (not manifest_target.is_file() or digest(manifest_target) != digest(root / "SOURCE_MANIFEST.json"))):
        conflicts.append("SOURCE_MANIFEST.json")
    return conflicts

def stage_copy(root: Path, destination: Path, rows: list[dict[str, str]]) -> None:
    blocked = collisions(root, destination, rows)
    if blocked:
        raise ValueError("Existing work differs. Reconcile it before publication: " + ", ".join(blocked[:20]))
    for row in rows:
        target = destination / row["path"]
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(root / row["path"], target)
    shutil.copy2(root / "SOURCE_MANIFEST.json", destination / "SOURCE_MANIFEST.json")

def git(args: list[str], cwd: Path | None = None, capture: bool = False) -> str:
    result = subprocess.run(["git", *args], cwd=cwd, check=True, text=True,
                            stdout=subprocess.PIPE if capture else None,
                            stderr=subprocess.PIPE if capture else None)
    return result.stdout.strip() if capture else ""

def check_staged_code(destination: Path) -> None:
    git(["diff", "--cached", "--check", "--", *CODE_PATHS], destination)

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepare", action="store_true", help="Clone current main and prepare a new integration branch, without pushing")
    parser.add_argument("--push", action="store_true", help="Prepare, commit and push the new branch. Never merge main")
    parser.add_argument("--directory", type=Path, help="New, empty destination for the staging clone")
    args = parser.parse_args()
    rows = records(ROOT)
    print(f"Verified {len(rows)} source files against the supplied SHA-256 manifest. This is integrity checking, not a security certificate.")
    if not args.prepare and not args.push:
        print("No network, commit, push or deployment performed. Use --prepare to stage a reviewed import.")
        return 0
    if not shutil.which("git"):
        raise ValueError("Install Git before preparing publication")
    destination = args.directory.resolve() if args.directory else Path(tempfile.mkdtemp(prefix="reunir-source-import-"))
    if destination.exists() and any(destination.iterdir()):
        raise ValueError("The staging directory must be new or empty")
    git(["clone", "--branch", "main", "--single-branch", REMOTE, str(destination)])
    branch = "build/reunir-source-" + digest(ROOT / "SOURCE_MANIFEST.json")[:10]
    git(["checkout", "-b", branch], destination)
    stage_copy(ROOT, destination, rows)
    git(["add", "--all"], destination)
    check_staged_code(destination)
    git(["diff", "--cached", "--stat"], destination)
    print(f"Staged source at {destination}. Review the diff. Existing work was preserved; differing paths would have stopped this import.")
    if not args.push:
        print("No commit or push performed. Run the release checks here and publish this branch after review.")
        return 0
    git(["commit", "-m", "feat: import verified REUNIR creator-authoring recovery source"], destination)
    git(["push", "--set-upstream", "origin", branch], destination)
    remote_line = git(["ls-remote", "--heads", "origin", branch], destination, capture=True)
    # Verify the exact remote ref rather than inferring success from a prior process exit.
    verified_local = git(["rev-parse", "HEAD"], destination, capture=True)
    if remote_line.split() != [verified_local, "refs/heads/" + branch]:
        raise ValueError("Push completed but remote ref verification failed. Inspect the branch before proceeding.")
    print(f"Remote branch verified: {branch} at {verified_local}. Main has not been merged. Check application CI and open a pull request.")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as error:
        print("Publication stopped: " + str(error), file=sys.stderr)
        raise SystemExit(1)
    except (KeyError, OSError, subprocess.CalledProcessError):
        # Git itself may show an ordinary local diagnostic; never add environment/credential dumps.
        print("Publication stopped. Inspect local configuration, manifest and any reported file conflicts. No force push was attempted.", file=sys.stderr)
        raise SystemExit(1)
