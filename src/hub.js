import { Server } from "socket.io";
const io = new Server();
io.listen(3500);

/// tracks all of the connected clients
const allClients = [];

class MessageHistory {
  constructor(maxLen) {
    this.maxLen = maxLen;
  }
  history = [];

  addToHistory(message) {
    this.history.push(message);
    if (this.history.length > this.maxLen) {
      this.history.shift();
    }
  }
}

class Command {
  constructor(name) {
    this.regex = /name/i;
    this.name = name;
  }

  // returns true or false if this command was used
  usedCommand() {
    // do not inherit
  }

  commandEffect() {
    return; //subtypes implement this
  }
}

const messageHistory = new MessageHistory(5);

function emitToOthers(ignoredId, signal, ...args) {
  for (const client of allClients) {
    if (client.id === ignoredId) {
      continue;
    }
    client.emit(signal, ...args);
  }
}

function onClientMessage(clientId, message) {
  const parsedMessage = parseMessage(message);
  emitToOthers(clientId, "hubMessage", parsedMessage, false, messageHistory.history);
  messageHistory.addToHistory(parsedMessage);
}

function parseMessage(messageObj) {
  const { name, content, timestamp } = messageObj;
  return `${name} at ${timestamp}: ${content}`;
}

function start() {
  io.on("connection", (client) => {
    allClients.push(client);
    client.on("clientMessage", onClientMessage);
  });
}

if (process.argv[2] === "start") {
  start();
}

export const hubStart = start;
