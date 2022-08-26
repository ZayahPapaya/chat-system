import { Server } from "socket.io";
import { emitToId, emitToOthers } from "./emit.js";
import { allCommands } from "./commands.js";
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

const messageHistory = new MessageHistory(5);

function onClientMessage(messageObj) {
  if (commandCheck(messageObj)) {
    return;
  }
  const parsedMessage = parseMessage(messageObj);
  emitToOthers(messageObj.id, "hubMessage", parsedMessage, false, messageHistory.history);
  messageHistory.addToHistory(parsedMessage);
}

function commandCheck(messageObj) {
  if (messageObj.content[0] !== "/") {
    return false;
  }
  // cuts off starting / of command
  messageObj.content = messageObj.content.substring(1);
  const commandArgs = messageObj.content.split(" ");
  const name = commandArgs[0];
  let usedCommand = false;
  for (const command of allCommands) {
    if (command.name === name) {
      commandArgs.shift();
      command.commandEffect(messageObj, ...commandArgs);
      usedCommand = true;
      break;
    }
  }
  if (!usedCommand) {
    const error = `Couldn't find command /${name}. Try /help for a list of commands.`;
    emitToId(messageObj.id, "hubMessage", error, false, messageHistory.history);
  }
  return true;
}

function parseMessage(messageObj) {
  const { name, content, timestamp } = messageObj;
  return `${name} at ${timestamp}: ${content}`;
}

function getClientByID(id) {
  let output;
  allClients.forEach(client => {
    client.id === id ? output = client : null;
  });
  return output;
}

function gatherUsername(messageObj) {
  let client = getClientByID(messageObj.id);
  if (!client) { return };
  client.username = messageObj.username;
}

function start() {
  io.on("connection", (client) => {
    client.on("clientUsername", gatherUsername);
    client.emit("gatherUsername");
    allClients.push(client);
    client.on("clientMessage", onClientMessage);
  });
}

if (process.argv[2] === "start") {
  start();
}

export const hubStart = start;
export const hubData = {
  clients: allClients,
  messageHistory: messageHistory,
};
