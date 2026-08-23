"""Firestore-backed A2A TaskStore.

Agent Engine replicas are ephemeral — the default InMemoryTaskStore loses task
state between the replica that accepted message:send and the one that answers a
later tasks/{id} poll (verified live: "Task not found"). Persisting tasks in
Firestore makes the A2A task lifecycle replica-safe.
"""
from typing import Optional

from a2a.server.tasks import TaskStore
from a2a.types import Task


class FirestoreTaskStore(TaskStore):
    def __init__(self, *, project: str, database: str = "dealguard",
                 collection: str = "a2a_tasks"):
        from google.cloud import firestore
        self._db = firestore.Client(project=project, database=database)
        self._collection = collection

    async def save(self, task: Task) -> None:
        self._db.collection(self._collection).document(task.id).set(
            {"task_json": task.model_dump_json()})

    async def get(self, task_id: str) -> Optional[Task]:
        snap = self._db.collection(self._collection).document(task_id).get()
        if not snap.exists:
            return None
        return Task.model_validate_json(snap.get("task_json"))

    async def delete(self, task_id: str) -> None:
        self._db.collection(self._collection).document(task_id).delete()
