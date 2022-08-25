import { io } from "socket.io-client";
import inquirer from "inquirer";
import { timestamp } from "./helpers.js";
import ansiEscapes from "ansi-escapes";
import fs from "fs";
import Chance from "chance";
import { createSpinner } from "nanospinner";
const chance = Chance();

const configPath = "./config.json";
let config = {};

const socket = io("ws://localhost:3500");

let promiseReject = null;
const InputPrompt = inquirer.prompt.prompts["input"];

export class RejectablePrompt extends InputPrompt {
  run(callback) {
    return new Promise((resolve, reject) => {
      promiseReject = reject;
      super.run(callback).then(resolve, reject);
    });
  }
}

inquirer.registerPrompt("rejInput", RejectablePrompt);

function onHubMessage(message, secondTry, messageHistory) {
  if (promiseReject && !secondTry) {
    promiseReject({
      name: "newHubMessage",
      waitingMessage: message,
      messageHistory: messageHistory,
    });
    return;
  }

  render(messageHistory);
  console.log(message);
}

function render(messageHistory) {
  //clear old
  process.stdout.write(ansiEscapes.clearTerminal);
  //repost message history
  // console.log(messageHistory.join("\n"));
  messageHistory.forEach((message) => console.log(message));
}

async function start() {
  // hooking signals
  socket.on("hubMessage", onHubMessage);

  // inquirer loop
  while (true) {
    const question = {
      type: "rejInput",
      name: "content",
      message: config.username + ":",
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
      name: config.username,
      content: response["content"],
      timestamp: timestamp(),
    };
    socket.emit("clientMessage", socket.id, userMessage);
  }
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
  try {
    fs.writeFileSync(configPath, JSON.stringify(config));
    return "created new config!";
  } catch (err) {
    console.log(err);
    return false;
  }
}

if (process.argv[2] === "start") {
  const configSpinner = createSpinner("loading config...").start();
  const result = loadConfig();
  if (!result) {
    configSpinner.error({ text: "failed to load config. try deleting your config.json." });
    process.exit(1);
  }
  configSpinner.success({ text: result });
  const serverSpinner = createSpinner("waiting for server...").start();
  socket.on("connect", () => {
    serverSpinner.success({ text: "connected to server!" });
    start();
  });
}

export const clientStart = start;
