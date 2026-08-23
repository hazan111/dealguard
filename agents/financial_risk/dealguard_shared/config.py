"""Central configuration, read from environment (.env is loaded by each service's entrypoint)."""
import os
from pathlib import Path


def load_dotenv(path: str | None = None) -> None:
    """Minimal .env loader — no external dependency. Existing env vars win."""
    candidates = [path] if path else []
    here = Path(__file__).resolve()
    candidates += [str(p / ".env") for p in [Path.cwd(), *here.parents]]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            for line in Path(candidate).read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())
            return


class Config:
    @property
    def project(self) -> str:
        return os.environ["GOOGLE_CLOUD_PROJECT"]

    @property
    def region(self) -> str:
        return os.environ.get("GOOGLE_CLOUD_REGION", "us-central1")

    @property
    def gemini_location(self) -> str:
        # Gemini 3.5 models are only served from the global endpoint on this
        # project (us-central1 returns 404) — verified 2026-08-23.
        return os.environ.get("GEMINI_LOCATION", "global")

    @property
    def gemini_model(self) -> str:
        return os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")

    @property
    def firestore_project(self) -> str:
        return os.environ.get("FIRESTORE_PROJECT_ID", self.project)

    @property
    def firestore_database(self) -> str:
        return os.environ.get("FIRESTORE_DATABASE", "dealguard")

    @property
    def model_armor_template(self) -> str:
        return os.environ.get("MODEL_ARMOR_TEMPLATE_ID", "dealguard-screen")

    @property
    def drive_folder_id(self) -> str:
        return os.environ["DRIVE_DATA_ROOM_FOLDER_ID"]

    @property
    def drive_sa_key_path(self) -> str:
        return os.environ.get("DRIVE_SERVICE_ACCOUNT_KEY_PATH", ".secrets/dealguard-runtime.json")


config = Config()
