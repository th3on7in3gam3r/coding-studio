import type { Workspace } from "./project";
import { validateProject } from "./project";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("coding-studio", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("workspace");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () =>
      reject(new Error("Close other Studio tabs to unlock saving"));
  });
}
export async function loadWorkspace(): Promise<Workspace | undefined> {
  const db = await open();
  try {
    const value = await new Promise<Workspace | undefined>(
      (resolve, reject) => {
        const r = db
          .transaction("workspace")
          .objectStore("workspace")
          .get("current");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      },
    );
    if (!value) return undefined;
    if (
      value.version !== 1 ||
      !Array.isArray(value.projects) ||
      !value.projects.length ||
      value.projects.length > 30
    )
      throw new Error(
        "Saved workspace has an unsupported format. Export a backup before resetting.",
      );
    const projects = value.projects.map(validateProject);
    return {
      ...value,
      projects,
      activeId: projects.some((p) => p.id === value.activeId)
        ? value.activeId
        : projects[0].id,
    };
  } finally {
    db.close();
  }
}
export async function saveWorkspace(value: Workspace) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction("workspace", "readwrite");
      t.objectStore("workspace").put(value, "current");
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}
