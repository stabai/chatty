import { contextBridge, ipcRenderer } from "electron";
import { IpcInterface, OpenClientOptions } from "./types";

// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
// window.addEventListener("DOMContentLoaded", () => {
//   const replaceText = (selector: string, text: string) => {
//     const element = document.getElementById(selector);
//     if (element) {
//       element.innerText = text;
//     }
//   };
//   for (const type of ["chrome", "node", "electron"]) {
//     replaceText(`${type}-version`, process.versions[type as keyof NodeJS.ProcessVersions]);
//   }
// });

const ipcApi: IpcInterface = {
  openClient: (options: OpenClientOptions) => ipcRenderer.send('openClient', options),
  reportNotificationCount: (clientId: string, count: number) => ipcRenderer.send('reportNotificationCount', clientId, count),
  // showNotification: (clientId: string, title: string, options: NotificationOptions = {}) => ipcRenderer.send('showNotification', clientId, title, options),
};

contextBridge.exposeInMainWorld('electronApi', ipcApi);
