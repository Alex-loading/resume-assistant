// The full profile store is accessible only to extension pages.
chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(console.error);

// Opening a native side panel keeps it visible while the user interacts with the page.
chrome.action.onClicked.addListener(tab => {
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
  chrome.runtime.sendMessage({ type: 'jianli:activate', windowId: tab.windowId }).catch(() => {});
});

// Release page listeners when the last panel observing that document disconnects.
const panels = new Map();
const sameTarget = (a, b) => a && b && a.tabId === b.tabId && a.documentId === b.documentId && a.watchId === b.watchId;
function release(target) {
  if (!target || [...panels.values()].some(other => sameTarget(target, other))) return;
  chrome.tabs.sendMessage(target.tabId, { type: 'jianli:stop-watch', watchId: target.watchId }, { documentId: target.documentId }).catch(() => {});
}
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'jianli-panel' || port.sender?.url !== chrome.runtime.getURL('panel.html')) return;
  panels.set(port, null);
  port.onMessage.addListener(message => {
    if (message.type !== 'bind') return;
    const previous = panels.get(port);
    const next = Number.isInteger(message.target?.tabId) && typeof message.target?.documentId === 'string' && typeof message.target?.watchId === 'string' ? message.target : null;
    panels.set(port, next);
    if (!sameTarget(previous, next)) release(previous);
  });
  port.onDisconnect.addListener(() => {
    const previous = panels.get(port); panels.delete(port); release(previous);
  });
});
