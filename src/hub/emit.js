import { hubData } from "./hub.js";

/// sends some signal to everyone but ignoredId
export function emitToOthers(ignoredId, signal, ...args) {
  for (const client of hubData.clients) {
    if (client.id === ignoredId) {
      continue;
    }
    client.emit(signal, ...args);
  }
}

/// sends some signal to only targetId
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
/// sends a hubMessage to targetId only
export function chatToId(targetId, message) {
  for (const client of hubData.clients) {
    if (client.id === targetId) {
      client.emit("hubMessage", message, false, hubData.messageHistory.history);
      return;
    }
  }
  throw new Error(`could not find ${targetId}!`);
}

/// sends a hubMessage to everyone BUT ignored Id
export function chatToOthers(ignoredId, message) {
  for (const client of hubData.clients) {
    if (client.id === ignoredId) {
      continue;
    }
    client.emit("hubMessage", message, false, hubData.messageHistory.history);
  }
}

export function cullClients() {
  const clients = hubData.clients;
  clients.forEach(client => {
    if(client.disconnected){
      clients.splice(clients.indexOf(client), 1);
    }
  });
}