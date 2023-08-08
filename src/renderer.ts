// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.

function addEventListeners(selector: string, eventType: string, listener: EventListenerOrEventListenerObject) {
  const elements = document.querySelectorAll(selector);
  elements.forEach(elem => {
    elem.addEventListener(eventType, listener);
  });
}

addEventListeners('button.client-button', 'click', e => {
  const clientId = (e.target as HTMLElement).dataset.clientId;
  window.electronApi.openClient({ clientId });
});

function setActiveView(clientId: string) {
  const views = document.querySelectorAll<HTMLElement>('#chatbar .client-button');
  for (const view of Array.from(views)) {
    view.classList.toggle('active', view.dataset.clientId === clientId);
  }
}
