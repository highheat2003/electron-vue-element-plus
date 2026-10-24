"""Build a platform-specific one-folder backend using the uv environment."""

import subprocess
import sys
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parent
    subprocess.run(
        [
            sys.executable, "-m", "PyInstaller",
            "--noconfirm", "--clean", "--onedir", "--console",
            "--name", "desktop-backend",
            "--distpath", str(root / "dist"),
            "--workpath", str(root / "build"),
            "--specpath", str(root / "build"),
            str(root / "run_backend.py"),
        ],
        cwd=root,
        check=True,
    )


if __name__ == "__main__":
    main()
