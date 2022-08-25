import { hubData } from "./hub.js";

export function emitToOthers(ignoredId, signal, ...args) {
  for (const client of hubData.clients) {
    if (client.id === ignoredId) {
      continue;
    }
    client.emit(signal, ...args);
  }
}

export function emitToId(targetId, signal, ...args) {
  for (const client of hubData.clients) {
    if (client.id === targetId) {
      client.emit(signal, ...args);
      return;
    }
  }
  throw new Error(`could not find ${targetId}!`);
}

/// because so many of our darn emits are just messages (it is a chat service after all)
/// this is a simpler function for only sending "hubMessage" signals
export function chatToId(targetId, message) {
  for (const client of hubData.clients) {
    if (client.id === targetId) {
      client.emit("hubMessage", message, false, hubData.messageHistory.history);
      return;
    }
  }
  throw new Error(`could not find ${targetId}!`);
}
