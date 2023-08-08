import { app, BrowserView, BrowserWindow, ipcMain, screen, shell } from "electron";
import * as path from "path";
import { IpcInterfaceHandlers, OpenClientOptions } from "./types";

let mainWindow: BrowserWindow;
const views: Record<string, BrowserView> = {};

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const displayAvail = Math.floor(0.85 * Math.min(display.workAreaSize.width, display.workAreaSize.height));
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: displayAvail,
    height: displayAvail,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
    icon: 'chatty_256.png',
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // Open the DevTools.
  // mainWindow.webContents.openDevTools({ mode: 'detach' });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  createWindow();
  loadChatViews();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  // if (process.platform !== "darwin") {
  app.quit();
  // }
});

function buildNotificationUpdateScript(clientId: string, countScript: string): string {
  return `
    const __getNotificationCount = () => {${countScript}};
    setInterval(() => {
      const notificationCount = __getNotificationCount();
      window.electronApi.reportNotificationCount('${clientId}', notificationCount);
    }, 5000);
  `;
}

const leftMargin = 84;

const CHAT_VIEWS = {
  gchat: {
    launchUrl: 'https://chat.google.com',
    notificationCountScript: `
      return Array.from(document.querySelectorAll('div.nH div.nH.bkL .XU'))
        .map(elem => Number(elem.textContent ?? '0'))
        .reduce((prev, cur) => prev + cur, 0);
    `,
  },
  slack: {
    launchUrl: 'https://app.slack.com/client/',
    notificationCountScript: `
      return Array.from(document.querySelectorAll('.p-channel_sidebar__channel .c-mention_badge'))
        .map(elem => Number(elem.textContent ?? '0'))
        .reduce((prev, cur) => prev + cur, 0);
    `,
  },
  discord: {
    launchUrl: 'https://discord.com/app/',
    notificationCountScript: `
      return Array.from(document.querySelectorAll('.listItem-3SmSlK .lowerBadge-3WTshO'))
        .map(elem => Number(elem.textContent ?? '0'))
        .reduce((prev, cur) => prev + cur, 0);
    `,
  },
  gmessages: {
    launchUrl: 'https://messages.google.com/web/conversations',
    notificationCountScript: `
      return document.querySelectorAll('nav.conversation-list .unread.text-content').length;
    `,
  },
  whatsapp: {
    launchUrl: 'https://web.whatsapp.com/',
    notificationCountScript: `
      return document.querySelectorAll('#pane-side div._3OvU8 > div._37FrU div._1i_wG div._1pJ9J').length;
    `,
  },
} as const;

const notificationCounts = Object.fromEntries(Object.keys(CHAT_VIEWS).map(id => [id, 0]));

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
function loadChatViews() {
  const contentBounds = mainWindow.getContentBounds();

  let firstClient: string;
  for (const [clientName, client] of Object.entries(CHAT_VIEWS)) {
    const view = new BrowserView({
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
      },
    });
    mainWindow.setBrowserView(view);
    view.setBounds({ x: leftMargin, y: 0, width: contentBounds.width - leftMargin, height: contentBounds.height })
    view.setAutoResize({ width: true, height: true });
    view.webContents.loadURL(client.launchUrl);
    views[clientName] = view;
    if (firstClient == null) {
      firstClient = clientName;
      // view.webContents.openDevTools();
    }

    view.webContents.setWindowOpenHandler(details => {
      console.log(details);
      shell.openExternal(details.url).catch(console.error);
      return { action: 'deny' };
    });

    view.webContents.executeJavaScript(
      buildNotificationUpdateScript(clientName, client.notificationCountScript));

    view.webContents.executeJavaScript(`
      const __nativeNotification = window.Notification;
      let Notification = class {
        constructor(title, options) {
          this.notification = new __nativeNotification(title, options);
          this.notification.addEventListener('click', () => {
            window.electronApi.openClient({clientId: '${clientName}'});
          });
        }
        close() {
          return this.notification.close(...arguments);
        }
        addEventListener() {
          return this.notification.addEventListener(...arguments);
        }

        get onclick() {return this.notification.onclick;}
        set onclick(value) {this.notification.onclick = value;}

        get onclose() {return this.notification.onclose;}
        set onclose(value) {this.notification.onclose = value;}

        get onerror() {return this.notification.onerror;}
        set onerror(value) {this.notification.onerror = value;}

        get onshow() {return this.notification.onshow;}
        set onshow(value) {this.notification.onshow = value;}
      };
      Notification.permission = 'granted';
      Notification.requestPermission = function() {
        return Promise.resolve('granted');
      }
      `);
  }

  openClient(undefined, { clientId: firstClient });
}

function handleIpcInterface(handlers: IpcInterfaceHandlers): void {
  for (const [functionName, handler] of Object.entries(handlers)) {
    ipcMain.on(functionName, handler);
  }
}

handleIpcInterface({
  openClient,
  reportNotificationCount,
});

function openClient(_: Event, options: OpenClientOptions): void {
  const view = views[options.clientId];
  mainWindow.setBrowserView(view);
  const contentBounds = mainWindow.getContentBounds();
  view.setBounds({ x: leftMargin, y: 0, width: contentBounds.width - leftMargin, height: contentBounds.height })
  view.setAutoResize({ width: true, height: true });
  mainWindow.webContents.executeJavaScript(`setActiveView('${options.clientId}');`);
}

function reportNotificationCount(_: Event, clientId: string, count: number): void {
  notificationCounts[clientId] = count;
  const displayCount = count === 0 ? '' : String(count);
  mainWindow.webContents.executeJavaScript(`
    document.querySelector('#chatbar .client-button[data-client-id=${clientId}] label.count').innerText = '${displayCount}';
  `);
  updateAppNotificationCount();
}

function updateAppNotificationCount() {
  const totalCount = Object.values(notificationCounts).reduce((prev, cur) => prev + cur, 0);
  app.setBadgeCount(totalCount);
}
