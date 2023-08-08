import { IpcMainEvent } from "electron";

export { };

declare global {
  interface Window {
    electronApi: IpcInterface;
  }
}

export interface IpcInterface {
  openClient(options: OpenClientOptions): void;
  reportNotificationCount(clientId: string, count: number): void;
  // showNotification(clientId: string, title: string, options?: NotificationOptions): void;
}

export interface OpenClientOptions {
  clientId: string;
}

export type IpcInterfaceHandlers = { [P in keyof IpcInterface]: (event: IpcMainEvent, ...options: Parameters<IpcInterface[P]>) => ReturnType<IpcInterface[P]> };
