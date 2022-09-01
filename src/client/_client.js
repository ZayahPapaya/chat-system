import { io } from "socket.io-client";
import inquirer from "inquirer";
import { timestamp } from "./client_helpers.js";
import ansiEscapes from "ansi-escapes";
import fs from "fs";
import Chance from "chance";
import { createSpinner } from "nanospinner";
const chance = Chance();

const configPath = "./config.json";
let config = {};

let connectionString = process.argv[3] === "local" ? "ws://localhost:3500" : "http://pogchat-env.eba-nn9tgy6w.us-east-1.elasticbeanstalk.com/";
const socket = io(connectionString);

let promiseResolve = null;
let interruptedInput = null;
const InputPrompt = inquirer.prompt.prompts["input"];
let priorityMessage;

export class ResolvablePrompt extends InputPrompt {
  run(callback) {
    return new Promise((resolve, reject) => {
      promiseResolve = resolve;
      super.run(callback).then(resolve, reject);
    });
  }
}

inquirer.registerPrompt("resInput", ResolvablePrompt);

function onHubMessage(newPriorityMessage, secondTry, messageHistory) {
  if (promiseResolve && !secondTry) {
    interruptedInput = promiseResolve({
      name: "newHubMessage",
      waitingMessage: newPriorityMessage,
      messageHistory: messageHistory,
    });
    return;
  }
  if (newPriorityMessage) {
    priorityMessage = newPriorityMessage;
  }
  render(messageHistory);
}

function onUpdateName(newName) {
  socket.emit("clientUsername", { id: socket.id, username: newName });
  config.username = newName;
  saveConfig();
}

function render(messageHistory) {
  //clear old
  process.stdout.write(ansiEscapes.clearTerminal);
  //repost message history
  messageHistory.forEach((message) => console.log(message));
  if (priorityMessage) {
    console.log(priorityMessage);
  }
}

function sendUsername() {
  socket.emit("clientUsername", { id: socket.id, username: config.username });
}

async function start() {
  // hooking signals
  socket.on("hubMessage", onHubMessage);
  socket.on("updateName", onUpdateName);
  socket.once("gatherUsername", sendUsername);

  // inquirer loop
  let shouldRestart = false;
  while (!shouldRestart) {
    const question = {
      type: "resInput",
      name: "content",
      message: config.username + ":",
      default: interruptedInput,
    };
    let response;
    try {
      response = await inquirer.prompt(question);
    } catch (error) {
      throw new Error(error);
    }
    // no content input should not bother the server
    if (!response["content"]) {
      continue;
    }
    // when resolving, it sets the question's content response as the resolve argument.
    // basically, sometimes content will be the string the person answered, and sometimes
    // it'll be the new hub messsage. PAINNNN
    if (typeof response["content"] === "object") {
      // response is an interrupting obj
      const interrupting = response["content"];
      onHubMessage(interrupting.waitingMessage, true, interrupting.messageHistory);
      continue;
    }
    // response is the client's input
    const userMessage = {
      id: socket.id,
      name: config.username,
      content: response["content"],
      timestamp: timestamp(),
    };
    socket.emit("clientMessage", userMessage);
    priorityMessage = null;
    interruptedInput = null;
    await new Promise((resolve, reject) => {
      if (socket.disconnected) {
        reject("server died");
      }
      socket.once("messageReceived", (messageHistory) => {
        render(messageHistory);
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
  socket.once("connect", async () => {
    serverSpinner.success({ text: "connected to server!" });
    const historySpinner = createSpinner("fetching chat history...").start();
    await new Promise((resolve) => {
      socket.once("hubHistory", (history) => {
        //you won't see text after render so no point in putting text in
        historySpinner.success();
        render(history);
        resolve();
      });
      socket.emit("clientHistory", socket.id);
    });
    start();
  });
}

prestart();

export const clientStart = start;
