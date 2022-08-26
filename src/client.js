import { io } from "socket.io-client";
import inquirer from "inquirer";
import { timestamp, parseMessage } from "./helpers.js";
import ansiEscapes from "ansi-escapes";
import fs from "fs";
import Chance from "chance";
import { createSpinner } from "nanospinner";
const chance = Chance();

const configPath = "./config.json";
let config = {};
//"https://pog-chat.herokuapp.com/"
const socket = io("ws://localhost:3500");

let promiseResolve = null;
let interruptedInput = null;
const InputPrompt = inquirer.prompt.prompts["input"];
let priorityMessage;
let mostRecentHistory = [];

export class ResolvablePrompt extends InputPrompt {
  run(callback) {
    return new Promise((resolve, reject) => {
      promiseResolve = resolve;
      super.run(callback).then(resolve, reject);
    });
  }
}

inquirer.registerPrompt("resInput", ResolvablePrompt);

function onHubMessage(message, secondTry, messageHistory) {
  if (promiseResolve && !secondTry) {
    interruptedInput = promiseResolve({
      name: "newHubMessage",
      waitingMessage: message,
      messageHistory: messageHistory,
    });
    return;
  }
  if (message) {
    priorityMessage = message;
  }
  mostRecentHistory = messageHistory;
  render();
}

function onUpdateName(newName) {
  socket.emit("clientUsername", { id: socket.id, username: newName });
  config.username = newName;
  saveConfig();
}

function render() {
  //clear old
  process.stdout.write(ansiEscapes.clearTerminal);
  //repost message history
  mostRecentHistory.forEach((message) => console.log(message));
  if (priorityMessage) {
    console.log(priorityMessage);
  }
}

function sendUsername() {
  socket.emit("clientUsername", { id: socket.id, username: config.username });
}

function onTryFix() {
  render();
}

async function start() {
  // hooking signals
  socket.on("hubMessage", onHubMessage);
  socket.on("tryFix", onTryFix);
  socket.on("updateName", onUpdateName);
  socket.once("gatherUsername", sendUsername);

  // inquirer loop
  let shouldRestart = false;
  while (!shouldRestart) {
    const question = {
      type: "rejInput",
      name: "content",
      message: config.username + ":",
      default: interruptedInput,
    };
    let promptPromise = inquirer.prompt(question);
    let response;
    try {
      response = await promptPromise;
    } catch (error) {
      if (error.name !== "newHubMessage") {
        throw new Error(error);
      }
      onHubMessage(error.waitingMessage, true, error.messageHistory);
      continue;
    }

    if (!response["content"]) {
      continue;
    }
    const userMessage = {
      id: socket.id,
      name: config.username,
      content: response["content"],
      timestamp: timestamp(),
    };
    socket.emit("clientMessage", userMessage);
    priorityMessage = null;
    interruptedInput = null;
    mostRecentHistory.push(parseMessage(userMessage));
    render();
    await new Promise((resolve, reject) => {
      if (socket.disconnected) {
        reject();
      }
      socket.once("messageReceived", () => {
        resolve();
      });
    }).then(
      (_) => {},
      (_) => (shouldRestart = true)
    );
  }
  console.log("Lost connection to server, trying to reconnect...");
  prestart();
}

function loadConfig() {
  // config exists, read it
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch (err) {
      console.log(err);
    }
    return "config loaded!";
  }
  // config doesn't exist, load default
  config = {
    username: chance.animal() + chance.integer({ min: 1000, max: 9999 }),
    //config todo stuff
    //textColor
    //aboutMe (command to view others)

    //other todo stuff
    //add spinners
    //live server
    //cleanup functions, maybe own files etc
    //chat commands
    //- admin stuff ^ stretch of above
    //- who command
  };
  return saveConfig();
}

function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config));
    return "created new config!";
  } catch (err) {
    console.log(err);
    return false;
  }
}

function prestart() {
  if (process.argv[2] !== "start") {
    return;
  }
  const configSpinner = createSpinner("loading config...").start();
  const result = loadConfig();
  if (!result) {
    configSpinner.error({ text: "failed to load config. try deleting your config.json." });
    process.exit(1);
  }
  configSpinner.success({ text: result });
  const serverSpinner = createSpinner("waiting for server...").start();
  socket.once("connect", () => {
    serverSpinner.success({ text: "connected to server!" });
    start();
  });
}

prestart();

export const clientStart = start;
