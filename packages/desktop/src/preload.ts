import { contextBridge, ipcRenderer } from "electron";

/**
 * Safe bridge between the sandboxed renderer and the main process.
 * The renderer only ever talks to `window.clockApi`.
 */
const clockApi = {
  getState: () => ipcRenderer.invoke("get-state"),
  login: (serverUrl: string, email: string, password: string) =>
    ipcRenderer.invoke("login", { serverUrl, email, password }),
  logout: () => ipcRenderer.invoke("logout"),
  clockIn: (category: string) => ipcRenderer.invoke("clock-in", { category }),
  clockOut: () => ipcRenderer.invoke("clock-out"),
  addEntry: (fields: unknown) => ipcRenderer.invoke("add-entry", fields),
  updateEntry: (args: unknown) => ipcRenderer.invoke("update-entry", args),
  deleteEntry: (id: string) => ipcRenderer.invoke("delete-entry", { id }),
  syncNow: () => ipcRenderer.invoke("sync-now"),
  onState: (cb: (state: unknown) => void) => {
    const listener = (_e: unknown, state: unknown) => cb(state);
    ipcRenderer.on("state", listener);
    return () => ipcRenderer.removeListener("state", listener);
  },
};

contextBridge.exposeInMainWorld("clockApi", clockApi);

export type ClockApi = typeof clockApi;
